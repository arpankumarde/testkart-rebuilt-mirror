import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Mathematics from '@tiptap/extension-mathematics';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Youtube } from '@tiptap/extension-youtube';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { 
  Bold, Italic, List, ListOrdered, FunctionSquare, Heading2, Heading3, 
  ImagePlus, Loader2, HelpCircle, Table as TableIcon, Youtube as YoutubeIcon, 
  Video as VideoIcon, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Trash2, 
  Settings2, Underline as UnderlineIcon, Strikethrough, Quote, Link2, Code2, Minus,
  Eye, EyeOff, PackagePlus, Film
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from './DropdownMenu';
import { FormulaInsertDialog } from './FormulaInsertDialog';
import { LaTeXGuidelinesDialog } from './LaTeXGuidelinesDialog';
import { ProductEmbedPickerDialog } from './ProductEmbedPickerDialog';
import { toast } from 'sonner';
import { Button } from './Button';
import { uploadFileToR2 } from '../helpers/useR2Upload';
import { useUploadLimits } from '../helpers/useUploadLimits';
import { EmbeddedProductItem, toEmbeddedProductItem, formatEmbedPrice } from '../helpers/blogProductEmbed';
import { ProductSearchItem } from '../endpoints/admin/blog/product-search_GET.schema';
import styles from './RichTextEditor.module.css';

// A DOMOutputSpec-shaped tree, the same array format Tiptap's renderHTML
// accepts natively (['tag', attrs?, ...children]). Building product embed
// cards through this shared shape lets the exact same layout be used both
// for the serialized HTML (via renderHTML, saved to the post) and for the
// live editor preview (via domSpecToElement, used in the node view) —
// one definition of what a card looks like, not two.
type DomSpec = string | [string, Record<string, string>?, ...DomSpec[]];

function buildEmbedCardSpec(item: EmbeddedProductItem): DomSpec {
  const priceChildren: DomSpec[] = item.isFree
    ? [['span', { class: 'product-embed-price' }, 'Free']]
    : [
        ['span', { class: 'product-embed-price' }, formatEmbedPrice(item.price)],
        ...(item.originalPrice
          ? ([['span', { class: 'product-embed-price-original' }, formatEmbedPrice(item.originalPrice)]] as DomSpec[])
          : []),
      ];

  const bodyChildren: DomSpec[] = [
    ['span', { class: 'product-embed-badge' }, item.badge],
    ['h4', { class: 'product-embed-title' }, item.title],
    ...(item.teacherName ? ([['span', { class: 'product-embed-teacher' }, `by ${item.teacherName}`]] as DomSpec[]) : []),
    ['div', { class: 'product-embed-price-row' }, ...priceChildren],
    ['span', { class: 'product-embed-cta' }, 'View Details →'],
  ];

  return [
    'a',
    { class: 'product-embed-card', href: item.href, target: '_blank', rel: 'noopener noreferrer' },
    item.thumbnailUrl
      ? ['img', { src: item.thumbnailUrl, alt: item.title, class: 'product-embed-thumb' }]
      : ['div', { class: 'product-embed-thumb product-embed-thumb-placeholder' }],
    ['div', { class: 'product-embed-body' }, ...bodyChildren],
  ];
}

function domSpecToNode(spec: DomSpec): globalThis.Node {
  if (typeof spec === 'string') return document.createTextNode(spec);
  const [tag, attrs, ...children] = spec;
  const el = document.createElement(tag);
  if (attrs) {
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  }
  children.forEach((child) => el.appendChild(domSpecToNode(child)));
  return el;
}

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disableMediaUpload?: boolean;
  // "full" (default, unchanged everywhere it isn't explicitly overridden) shows
  // every formatting tool. "minimal" trims the toolbar down to just Bold,
  // Italic, Bullet List, Table, Formula and Image — used only by the question
  // editor's question/option fields, which asked for a lighter-weight toolbar.
  toolbarPreset?: 'full' | 'minimal';
  // Optional override for the editable area's minimum height (defaults to the
  // existing 200px via CSS when omitted, so every other call site is unaffected).
  minHeight?: string | number;
  // "always" (default, unchanged everywhere) shows the toolbar permanently.
  // "collapsible" starts with the toolbar hidden — the field looks like a
  // plain input — with a small "Aa" toggle to reveal formatting on demand.
  // Used only where a field should feel like filling out a form (e.g.
  // question options), not composing rich content.
  toolbarVisibility?: 'always' | 'collapsible';
  // Shows the "Insert products" toolbar button, which opens a picker for
  // featuring mock tests/study notes/courses/bundles inline in the content.
  // Defaults to off everywhere; the blog post editor is the only call site
  // that turns it on. The productEmbed node itself is always registered
  // (regardless of this flag) so any editor can still open and re-save
  // content that already contains an embed without losing it.
  enableProductEmbed?: boolean;
}

const CustomImage = Image.extend({
  inline: false,
  group: 'block',

  addAttributes() {
    return {
      ...(this as any).parent?.(),
      caption: {
        default: '',
        parseHTML: (element: HTMLElement) => {
          if (element.tagName.toLowerCase() === 'figure') {
            const figcaption = element.querySelector('figcaption');
            return figcaption?.textContent || '';
          }
          return '';
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure.image-figure',
        getAttrs: (node: HTMLElement | string) => {
          if (!(node instanceof HTMLElement)) return false;
          const img = node.querySelector('img');
          if (!img) return false;
          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt'),
            title: img.getAttribute('title'),
          };
        },
      },
      {
        tag: 'img[src]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, any> }) {
    if (HTMLAttributes.caption) {
      const { caption, ...attrs } = HTMLAttributes;
      return [
        'figure',
        { class: 'image-figure' },
        ['img', attrs],
        ['figcaption', { class: 'image-caption' }, caption],
      ];
    }
    const { caption, ...attrs } = HTMLAttributes;
    return ['img', attrs];
  },

  addNodeView() {
    return (({ node, getPos, editor }: { node: any, getPos: (() => number) | boolean, editor: any }) => {
      const figure = document.createElement('figure');
      figure.className = 'image-figure';

      const img = document.createElement('img');
      img.src = node.attrs.src;
      img.className = 'editor-image';
      if (node.attrs.alt) img.alt = node.attrs.alt;
      if (node.attrs.title) img.title = node.attrs.title;

      const figcaption = document.createElement('figcaption');
      figcaption.className = 'image-caption';
      figcaption.contentEditable = 'true';
      figcaption.dataset.placeholder = 'Add a caption...';
      figcaption.textContent = node.attrs.caption || '';

      figcaption.addEventListener('input', () => {
        if (typeof getPos === 'function') {
          const tr = editor.state.tr.setNodeMarkup(getPos(), undefined, {
            ...node.attrs,
            caption: figcaption.textContent,
          });
          editor.view.dispatch(tr);
        }
      });

      figcaption.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
        }
      });

      figure.appendChild(img);
      figure.appendChild(figcaption);

      return {
        dom: figure,
        update: (updatedNode: any) => {
          if (updatedNode.type !== this.type) return false;
          
          if (img.src !== updatedNode.attrs.src) {
            img.src = updatedNode.attrs.src;
          }
          if (img.alt !== updatedNode.attrs.alt) {
            img.alt = updatedNode.attrs.alt || '';
          }
          if (img.title !== updatedNode.attrs.title) {
            img.title = updatedNode.attrs.title || '';
          }
          
          if (document.activeElement !== figcaption) {
            figcaption.textContent = updatedNode.attrs.caption || '';
          }
          return true;
        },
        stopEvent: (e: Event) => {
          return figcaption.contains(e.target as Node);
        },
        selectNode: () => {
          figure.classList.add('selected');
        },
        deselectNode: () => {
          figure.classList.remove('selected');
        },
      };
    }) as any;
  },
});

/**
 * Custom Table extension that adds a `showBorders` attribute to allow toggling table borders.
 */
const CustomTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      showBorders: {
        default: true,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-borders') !== 'false',
        renderHTML: (attributes: Record<string, any>) => {
          if (attributes.showBorders === false) {
            return { 'data-borders': 'false', class: 'borderless' };
          }
          return { 'data-borders': 'true' };
        },
      },
    };
  },
});

/**
 * A block "card" (or row of cards) that embeds one or more products — mock
 * tests, study notes, courses, or bundles — inline in the content. The full
 * display snapshot (title, thumbnail, price, link) is baked into the node's
 * `items` attribute at insert time and serialized straight into the saved
 * HTML as plain div/a/img/span tags, the same way CustomImage bakes a real
 * `src` in. That means the public blog page needs zero extra plumbing: its
 * existing DOMPurify.sanitize() + dangerouslySetInnerHTML already renders it.
 */
const ProductEmbed = TiptapNode.create({
  name: 'productEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      items: {
        default: [] as EmbeddedProductItem[],
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute('data-items');
          if (!raw) return [];
          try {
            return JSON.parse(decodeURIComponent(raw));
          } catch {
            return [];
          }
        },
        renderHTML: (attributes: { items: EmbeddedProductItem[] }) => {
          return { 'data-items': encodeURIComponent(JSON.stringify(attributes.items || [])) };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-product-embed]' }];
  },

  renderHTML({ node, HTMLAttributes }: { node: any, HTMLAttributes: Record<string, any> }) {
    const items: EmbeddedProductItem[] = node.attrs.items || [];
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'product-embed-block', 'data-product-embed': 'true' }),
      ['div', { class: 'product-embed-grid' }, ...items.map(buildEmbedCardSpec)],
    ] as any;
  },

  addNodeView() {
    return (({ node, editor, getPos }: { node: any, editor: any, getPos: (() => number) | boolean }) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'product-embed-block product-embed-block-editor';
      wrapper.contentEditable = 'false';

      const grid = document.createElement('div');
      grid.className = 'product-embed-grid';
      wrapper.appendChild(grid);

      const toolbar = document.createElement('div');
      toolbar.className = 'product-embed-node-toolbar';
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'product-embed-remove-btn';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof getPos === 'function') {
          const pos = getPos();
          editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
        }
      });
      toolbar.appendChild(removeBtn);
      wrapper.appendChild(toolbar);

      const renderItems = (items: EmbeddedProductItem[]) => {
        grid.innerHTML = '';
        items.forEach((item) => {
          grid.appendChild(domSpecToNode(buildEmbedCardSpec(item)));
        });
      };

      renderItems(node.attrs.items || []);

      return {
        dom: wrapper,
        update: (updatedNode: any) => {
          if (updatedNode.type.name !== 'productEmbed') return false;
          renderItems(updatedNode.attrs.items || []);
          return true;
        },
        selectNode: () => wrapper.classList.add('selected'),
        deselectNode: () => wrapper.classList.remove('selected'),
      };
    }) as any;
  },
});

/**
 * A video - uploaded, or linked by URL from the toolbar - stored as a real schema node. It has to be a node: the
 * toolbar's video button used to insertContent() a raw "<video ...></video>"
 * HTML string, and with nothing in the schema matching the tag, Tiptap fell
 * back to inserting the markup as plain text - which getHTML() then escaped
 * to &lt;video&gt; and saved, so the article showed the tag as literal text
 * instead of a player. Serializes to a plain <video controls> tag so the
 * public blog and knowledge base pages render it through their existing
 * DOMPurify + dangerouslySetInnerHTML path, the same as CustomImage and
 * ProductEmbed.
 */
const Video = TiptapNode.create({
  name: 'video',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      src: { default: null },
      poster: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'video[src]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, any> }) {
    return [
      'video',
      mergeAttributes(HTMLAttributes, {
        controls: 'true',
        preload: 'metadata',
        playsinline: 'true',
      }),
    ] as any;
  },

  addNodeView() {
    return (({ node, editor, getPos }: { node: any, editor: any, getPos: (() => number) | boolean }) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'editor-video-block';
      wrapper.contentEditable = 'false';

      const video = document.createElement('video');
      video.className = 'editor-video';
      video.controls = true;
      video.preload = 'metadata';
      video.playsInline = true;
      if (node.attrs.src) video.setAttribute('src', node.attrs.src);
      if (node.attrs.poster) video.setAttribute('poster', node.attrs.poster);
      wrapper.appendChild(video);

      const toolbar = document.createElement('div');
      toolbar.className = 'editor-video-toolbar';
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'editor-video-remove-btn';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof getPos === 'function') {
          const pos = getPos();
          editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
        }
      });
      toolbar.appendChild(removeBtn);
      wrapper.appendChild(toolbar);

      return {
        dom: wrapper,
        update: (updatedNode: any) => {
          if (updatedNode.type.name !== 'video') return false;
          if (video.getAttribute('src') !== updatedNode.attrs.src) {
            video.setAttribute('src', updatedNode.attrs.src || '');
          }
          return true;
        },
        selectNode: () => wrapper.classList.add('selected'),
        deselectNode: () => wrapper.classList.remove('selected'),
      };
    }) as any;
  },
});

/**
 * Transforms HTML content from the database (which might use legacy data-katex-content or data-katex)
 * to the format expected by the current Tiptap Mathematics extension (data-latex).
 */
const transformHtmlForEditor = (html: string): string => {
  if (!html) return '';
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const processElement = (el: Element) => {
    const katexContent = el.getAttribute('data-katex-content');
    const katex = el.getAttribute('data-katex');
    const latex = el.getAttribute('data-latex');

    if (katexContent || katex || latex) {
      console.log('[RichTextEditor] Found math element candidate:', {
        tagName: el.tagName,
        katexContent: katexContent ? `${katexContent.substring(0, 20)}...` : null,
        katex: katex ? `${katex.substring(0, 20)}...` : null,
        latex: latex ? `${latex.substring(0, 20)}...` : null
      });
    }

    if (!latex) {
      const contentToMigrate = katexContent || katex;
      if (contentToMigrate) {
        el.setAttribute('data-latex', contentToMigrate);
        console.log('[RichTextEditor] Migrated attribute to data-latex');
      }
    }
  };

  doc.querySelectorAll('span[data-type="inline-math"]').forEach(processElement);
  doc.querySelectorAll('div[data-type="block-math"]').forEach(processElement);

  // Even older data still floating around uses a completely different node
  // shape: <span data-type="mathematics" data-math="...">. The current
  // Mathematics extension's schema doesn't recognize data-type="mathematics"
  // at all, so these spans were being silently dropped by the HTML parser on
  // load — for an option that's *entirely* a formula (no surrounding text),
  // that made the whole field look empty. Retarget both the attribute name
  // and the data-type so it parses into a real inline-math node.
  doc.querySelectorAll('span[data-type="mathematics"][data-math]').forEach((el) => {
    const mathContent = el.getAttribute('data-math');
    if (mathContent && !el.getAttribute('data-latex')) {
      el.setAttribute('data-latex', mathContent);
      el.setAttribute('data-type', 'inline-math');
      console.log('[RichTextEditor] Migrated legacy data-type="mathematics" span to inline-math');
    }
  });

  const result = doc.body.innerHTML;
  if (html !== result) {
    console.log('[RichTextEditor] HTML was transformed for editor compatibility');
  }
  return result;
};

export const RichTextEditor = ({
  value,
  onChange,
  placeholder,
  className,
  disableMediaUpload,
  toolbarPreset = 'full',
  minHeight,
  toolbarVisibility = 'always',
  enableProductEmbed = false,
}: RichTextEditorProps) => {
  const isMinimal = toolbarPreset === 'minimal';
  const isCollapsible = toolbarVisibility === 'collapsible';
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);
  const showToolbar = !isCollapsible || isToolbarOpen;
  const limits = useUploadLimits();
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isFormulaDialogOpen, setIsFormulaDialogOpen] = useState(false);
  const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [editingFormulaPos, setEditingFormulaPos] = useState<number | null>(null);
  const [editingFormulaText, setEditingFormulaText] = useState<string>('');
  const [editingFormulaType, setEditingFormulaType] = useState<string>('inline-math');
  const [, forceRender] = useState(0);
   
  const uploadRef = useRef<HTMLInputElement>(null);
  const uploadVideoRef = useRef<HTMLInputElement>(null);
  // HTML this editor recently reported through onChange. A parent rendering
  // with one of these is an echo, not an external change, and the editor may
  // already hold newer keystrokes that a sync would roll back.
  const recentlyEmittedHtmlRef = useRef<string[]>([]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
        link: false,
        underline: false,
      }) as any,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Underline,
      Mathematics.configure({
        katexOptions: {
          throwOnError: false,
        },
      }),
      CustomImage.configure({
        allowBase64: false,
      }),
      CustomTable.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Youtube.configure({
        inline: false,
      }),
      Video,
      ProductEmbed,
    ],
    content: transformHtmlForEditor(value),
    editorProps: {
      attributes: {
        class: styles.editorContent,
      },
      transformPastedHTML(html) {
        let cleaned = html;
        // Remove Google Docs specific IDs
        cleaned = cleaned.replace(/ id="docs-internal-guid-[^"]*"/g, '');
        // Remove dir attributes  
        cleaned = cleaned.replace(/ dir="ltr"/g, '');
        // Convert b/i to strong/em for consistency
        cleaned = cleaned.replace(/<b(\s|>)/g, '<strong$1').replace(/<\/b>/g, '</strong>');
        cleaned = cleaned.replace(/<i(\s|>)/g, '<em$1').replace(/<\/i>/g, '</em>');
        return cleaned;
      }
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      recentlyEmittedHtmlRef.current = [...recentlyEmittedHtmlRef.current.slice(-19), html];
      onChange(html);
    },
    onSelectionUpdate: () => {
      forceRender(prev => prev + 1);
    },
    onTransaction: ({ transaction }) => {
      if (transaction.docChanged || transaction.selectionSet) {
        forceRender(prev => prev + 1);
      }
    },
  });

  const toggleTableBorders = useCallback(() => {
    if (!editor) return;
    const attrs = editor.getAttributes('table');
    const currentShow = attrs.showBorders !== false;
    editor.chain().focus().updateAttributes('table', { showBorders: !currentShow }).run();
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    if (recentlyEmittedHtmlRef.current.includes(value ?? "")) return;
    const currentContent = editor.getHTML();
    // Tiptap normalizes "no content" to "<p></p>", not "". Treat both as
    // equivalent so this doesn't loop on mount - but still let a real
    // external reset (saved content coming back empty/lost, switching to a
    // fresh unauthored page, etc.) actually clear the editor instead of
    // leaving stale text on screen that no longer matches what's saved.
    const currentIsEmpty = !currentContent || currentContent === "<p></p>";
    const valueIsEmpty = !value;
    if (currentIsEmpty && valueIsEmpty) return;
    if (currentContent !== value) {
      const transformedValue = transformHtmlForEditor(value || "");
      if (currentContent !== transformedValue) {
        // Syncing from props is not an edit. Tiptap 3 emits onUpdate here by
        // default, which echoed normalized HTML back and made loaded content look unsaved.
        editor.commands.setContent(transformedValue, { emitUpdate: false });
        recentlyEmittedHtmlRef.current = [];
      }
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  const toggleBold = () => editor.chain().focus().toggleBold().run();
  const toggleItalic = () => editor.chain().focus().toggleItalic().run();
  const toggleBulletList = () => (editor.chain().focus() as any).toggleBulletList().run();
  const toggleOrderedList = () => (editor.chain().focus() as any).toggleOrderedList().run();
  const setHeading = (level: 2 | 3) => editor.chain().focus().toggleHeading({ level }).run();
  
  const insertFormula = () => {
    setEditingFormulaPos(null);
    setEditingFormulaText('');
    setEditingFormulaType('inline-math');
    setIsFormulaDialogOpen(true);
  };

  const handleFormulaInsert = (formula: string) => {
    if (!editor) return;

    const commands = editor.commands as any;
    const type = editingFormulaPos !== null ? editingFormulaType : 'inline-math';
    
    if (editingFormulaPos !== null) {
      editor.chain().focus().setNodeSelection(editingFormulaPos).run();
      if (type === 'block-math') {
        commands.updateBlockMath({ latex: formula });
      } else {
        commands.updateInlineMath({ latex: formula });
      }
    } else {
      commands.insertInlineMath({ latex: formula });
    }

    setIsFormulaDialogOpen(false);
    setEditingFormulaPos(null);
    setEditingFormulaText('');
    setEditingFormulaType('inline-math');
  };

  useEffect(() => {
    if (!editor) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      const pos = editor.view.posAtDOM(target, 0);
      if (pos === null || pos < 0) return;

      const $pos = editor.state.doc.resolve(pos);
      const nodeAfter = $pos.nodeAfter;
      const parent = $pos.parent;
      const nodeAt = editor.state.doc.nodeAt(pos);

      let targetNode: any = null;
      let targetPos: number | null = null;

      if (nodeAfter && (nodeAfter.type.name === 'inline-math' || nodeAfter.type.name === 'block-math')) {
        targetNode = nodeAfter;
        targetPos = pos;
      } else if (parent && (parent.type.name === 'inline-math' || parent.type.name === 'block-math')) {
        targetNode = parent;
        targetPos = $pos.before($pos.depth);
      } else if (nodeAt && (nodeAt.type.name === 'inline-math' || nodeAt.type.name === 'block-math')) {
        targetNode = nodeAt;
        targetPos = pos;
      }

      if (targetNode && targetPos !== null) {
        const latex = targetNode.attrs.latex;
        const type = targetNode.type.name;

        if (latex !== undefined) {
          setEditingFormulaPos(targetPos);
          setEditingFormulaText(latex);
          setEditingFormulaType(type);
          setIsFormulaDialogOpen(true);

          event.preventDefault();
          event.stopPropagation();
        }
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener('click', handleClick);

    return () => {
      editorElement.removeEventListener('click', handleClick);
    };
  }, [editor]);

  const openGuidelines = () => setIsGuidelinesOpen(true);
  const handleImageUpload = () => uploadRef.current?.click();
  const handleVideoUpload = () => uploadVideoRef.current?.click();

  // Links a video hosted elsewhere without uploading it. YouTube links go to the
  // YouTube embed, since a watch page is not a playable file.
  const insertVideoFromUrl = () => {
    const input = window.prompt('Paste a direct link to a video file (MP4, WebM or Ogg). YouTube links work too.');
    if (input === null) return;
    const url = input.trim();
    if (!url) return;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      toast.error('That is not a valid link. Paste the full address, starting with https://');
      return;
    }
    if (parsed.protocol !== 'https:') {
      toast.error('The video link must start with https://');
      return;
    }

    if (/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/i.test(parsed.hostname)) {
      editor.chain().focus().setYoutubeVideo({ src: parsed.href }).run();
      return;
    }
    editor.chain().focus().insertContent({ type: 'video', attrs: { src: parsed.href } }).run();
  };

  const handleInsertProducts = (searchItems: ProductSearchItem[]) => {
    if (!editor || searchItems.length === 0) return;
    const items = searchItems.map(toEmbeddedProductItem);
    editor.chain().focus().insertContent({ type: 'productEmbed', attrs: { items } }).run();
  };

  const toggleLink = () => {
    // Pre-fill with the existing URL so clicking the toolbar button while the
    // cursor is inside a link lets you edit its destination, not just remove
    // it. Leaving the prompt empty removes the link; cancelling leaves it
    // untouched either way.
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL (leave empty to remove link)', previousUrl || '');
    if (url === null) return;

    // extendMarkRange expands the selection to cover the whole link mark (not
    // just the cursor position), so editing/removing applies to the entire
    // link even if nothing is explicitly selected.
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const containerStyle = minHeight != null ? ({ '--rte-min-height': typeof minHeight === 'number' ? `${minHeight}px` : minHeight } as React.CSSProperties) : undefined;

  return (
    <div className={`${styles.editorContainer} ${isCollapsible ? styles.editorContainerPlain : ''} ${className || ''}`} style={containerStyle}>
      {showToolbar && (
      <div className={styles.toolbar}>
        {!isMinimal && (
          <>
            <div className={styles.toolbarGroup}>
              <Button type="button" size="icon-sm" variant={editor.isActive('heading', { level: 2 }) ? 'primary' : 'ghost'} onClick={() => setHeading(2)} title="Heading 2"><Heading2 /></Button>
              <Button type="button" size="icon-sm" variant={editor.isActive('heading', { level: 3 }) ? 'primary' : 'ghost'} onClick={() => setHeading(3)} title="Heading 3"><Heading3 /></Button>
            </div>

            <div className={styles.toolbarDivider} />
          </>
        )}

        <div className={styles.toolbarGroup}>
          <Button type="button" size="icon-sm" variant={editor.isActive('bold') ? 'primary' : 'ghost'} onClick={toggleBold} title="Bold"><Bold /></Button>
          <Button type="button" size="icon-sm" variant={editor.isActive('italic') ? 'primary' : 'ghost'} onClick={toggleItalic} title="Italic"><Italic /></Button>
          {!isMinimal && (
            <>
              <Button type="button" size="icon-sm" variant={editor.isActive('underline') ? 'primary' : 'ghost'} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><UnderlineIcon /></Button>
              <Button type="button" size="icon-sm" variant={editor.isActive('strike') ? 'primary' : 'ghost'} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough"><Strikethrough /></Button>
            </>
          )}
        </div>

        <div className={styles.toolbarDivider} />

        <div className={styles.toolbarGroup}>
          <Button type="button" size="icon-sm" variant={editor.isActive('bulletList') ? 'primary' : 'ghost'} onClick={toggleBulletList} title="Bullet List"><List /></Button>
          {!isMinimal && (
            <>
              <Button type="button" size="icon-sm" variant={editor.isActive('orderedList') ? 'primary' : 'ghost'} onClick={toggleOrderedList} title="Ordered List"><ListOrdered /></Button>
              <Button type="button" size="icon-sm" variant={editor.isActive('blockquote') ? 'primary' : 'ghost'} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote"><Quote /></Button>
            </>
          )}
        </div>

        {!isMinimal && (
          <>
            <div className={styles.toolbarDivider} />

            <div className={styles.toolbarGroup}>
              <Button type="button" size="icon-sm" variant={editor.isActive('link') ? 'primary' : 'ghost'} onClick={toggleLink} title="Link"><Link2 /></Button>
              <Button type="button" size="icon-sm" variant={editor.isActive('codeBlock') ? 'primary' : 'ghost'} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code Block"><Code2 /></Button>
              <Button type="button" size="icon-sm" variant="ghost" onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule"><Minus /></Button>
            </div>
          </>
        )}

        <div className={styles.toolbarDivider} />

        <div className={styles.toolbarGroup}>
          {!disableMediaUpload && (
            <Button type="button" size="icon-sm" variant="ghost" onClick={handleImageUpload} disabled={isUploadingImage} title="Upload Image">
              {isUploadingImage ? <Loader2 className={styles.spinning} /> : <ImagePlus />}
            </Button>
          )}
          <Button type="button" size="icon-sm" variant="ghost" onClick={insertFormula} title="Insert Formula">
            <FunctionSquare />
          </Button>
          {!isMinimal && (
            <Button type="button" size="icon-sm" variant="ghost" onClick={openGuidelines} title="LaTeX Help & Reference">
              <HelpCircle />
            </Button>
          )}
        </div>

        <div className={styles.toolbarDivider} />

        <div className={styles.toolbarGroup}>
          <Button type="button" size="icon-sm" variant="ghost" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert Table">
            <TableIcon />
          </Button>
          {!disableMediaUpload && !isMinimal && (
            <>
              <Button type="button" size="icon-sm" variant="ghost" onClick={() => {
                const url = window.prompt('Enter YouTube Video URL');
                if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
              }} title="Embed YouTube Video">
                <YoutubeIcon />
              </Button>
              <Button type="button" size="icon-sm" variant="ghost" onClick={handleVideoUpload} disabled={isUploadingVideo} title="Upload Video">
                {isUploadingVideo ? <Loader2 className={styles.spinning} /> : <VideoIcon />}
              </Button>
              <Button type="button" size="icon-sm" variant="ghost" onClick={insertVideoFromUrl} title="Embed video from URL" aria-label="Embed video from URL">
                <Film />
              </Button>
            </>
          )}
          {enableProductEmbed && (
            <Button type="button" size="icon-sm" variant="ghost" onClick={() => setIsProductPickerOpen(true)} title="Insert products">
              <PackagePlus />
            </Button>
          )}
        </div>

        {editor.isActive('table') && (
          <>
            <div className={styles.toolbarDivider} />
            <div className={styles.toolbarGroup}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="ghost" title="Table Options" className={styles.tableDropdownTrigger}>
                    <Settings2 size={16} />
                    <span style={{ fontSize: '0.75rem', marginLeft: '4px' }}>Table ▾</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onSelect={() => editor.chain().focus().addRowBefore().run()}>
                    <ArrowUp size={14} style={{ marginRight: '8px' }} /> Insert Row Above
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => editor.chain().focus().addRowAfter().run()}>
                    <ArrowDown size={14} style={{ marginRight: '8px' }} /> Insert Row Below
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => editor.chain().focus().addColumnBefore().run()}>
                    <ArrowLeft size={14} style={{ marginRight: '8px' }} /> Insert Column Left
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => editor.chain().focus().addColumnAfter().run()}>
                    <ArrowRight size={14} style={{ marginRight: '8px' }} /> Insert Column Right
                  </DropdownMenuItem>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem onSelect={() => editor.chain().focus().toggleHeaderRow().run()}>
                    Toggle Header Row
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={toggleTableBorders}>
                    {editor.getAttributes('table').showBorders === false ? <Eye size={14} style={{ marginRight: '8px' }} /> : <EyeOff size={14} style={{ marginRight: '8px' }} />}
                    {editor.getAttributes('table').showBorders === false ? 'Show Borders' : 'Hide Borders'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => editor.chain().focus().deleteRow().run()}>
                    <Trash2 size={14} style={{ marginRight: '8px' }} /> Delete Row
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => editor.chain().focus().deleteColumn().run()}>
                    <Trash2 size={14} style={{ marginRight: '8px' }} /> Delete Column
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => editor.chain().focus().deleteTable().run()} className={styles.destructiveItem}>
                    <Trash2 size={14} style={{ marginRight: '8px' }} /> Delete Entire Table
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>
      )}

      {!disableMediaUpload && (
        <>
          <input
            type="file"
            ref={uploadRef}
            style={{ display: 'none' }}
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (e.target) e.target.value = '';
          if (!file) return;
          
          const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
          if (!validTypes.includes(file.type)) {
            toast.error('Please upload a valid image file (JPEG, PNG, GIF, or WebP)');
            return;
          }
          if (file.size > limits.richTextImageMaxMb * 1024 * 1024) {
            toast.error(`Image size must be less than ${limits.richTextImageMaxMb}MB`);
            return;
          }
          
          setIsUploadingImage(true);
          try {
            const result = await uploadFileToR2(file, 'editor-images');
            editor?.chain().focus().setImage({ src: result.url, alt: file.name || 'Uploaded image' }).run();
            toast.success('Image uploaded successfully');
          } catch (err) {
            console.error('Image upload error:', err);
            toast.error(err instanceof Error ? err.message : 'Failed to upload image');
          } finally {
            setIsUploadingImage(false);
          }
        }}
      />

      <input
        type="file"
        ref={uploadVideoRef}
        style={{ display: 'none' }}
        accept="video/*"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (e.target) e.target.value = '';
          if (!file) return;
          
          if (!file.type.startsWith('video/')) {
            toast.error('Please upload a valid video file');
            return;
          }
          if (file.size > limits.lessonVideoMaxMb * 1024 * 1024) {
            toast.error(`Video size must be less than ${limits.lessonVideoMaxMb}MB`);
            return;
          }
          
          setIsUploadingVideo(true);
          try {
            const result = await uploadFileToR2(file, 'editor-videos');
            editor?.chain().focus().insertContent({ type: 'video', attrs: { src: result.url } }).run();
            toast.success('Video uploaded successfully');
          } catch (err) {
            console.error('Video upload error:', err);
            toast.error(err instanceof Error ? err.message : 'Failed to upload video');
          } finally {
            setIsUploadingVideo(false);
          }
        }}
      />
        </>
      )}

      <EditorContent editor={editor} placeholder={placeholder} />

      {isCollapsible && (
        <button
          type="button"
          className={styles.formatToggleBar}
          onClick={() => setIsToolbarOpen((open) => !open)}
          aria-pressed={isToolbarOpen}
        >
          <span className={styles.formatToggleGlyph}>Aa</span>
          {isToolbarOpen ? 'Hide formatting' : 'Formatting options'}
        </button>
      )}

      <FormulaInsertDialog
        isOpen={isFormulaDialogOpen}
        onClose={() => {
          setIsFormulaDialogOpen(false);
          setEditingFormulaPos(null);
          setEditingFormulaText('');
          setEditingFormulaType('inline-math');
        }}
        onInsert={handleFormulaInsert}
        initialValue={editingFormulaText}
      />

      <LaTeXGuidelinesDialog
        open={isGuidelinesOpen}
        onOpenChange={setIsGuidelinesOpen}
      />

      {enableProductEmbed && (
        <ProductEmbedPickerDialog
          open={isProductPickerOpen}
          onOpenChange={setIsProductPickerOpen}
          onInsert={handleInsertProducts}
        />
      )}
    </div>
  );
};