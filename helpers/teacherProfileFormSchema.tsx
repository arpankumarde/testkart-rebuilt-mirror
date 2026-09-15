import { z } from 'zod';

export const teacherProfileFormSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters.'),
  slug: z.string()
    .min(1, 'Profile URL slug cannot be empty.')
    .min(3, 'Slug must be at least 3 characters.')
    .max(100, 'Slug must be 100 characters or less.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  avatarUrl: z.string().url('Please enter a valid URL.').or(z.literal('')).nullable(),
  avatarFileId: z.string().nullable().optional(),
  bio: z.string().optional(),
  tagline: z.string().max(150, 'Tagline must be 150 characters or less.').optional().nullable(),
  location: z.string().optional().nullable(),
  languages: z.array(z.string()).optional(),
  responseTime: z.string().optional().nullable(),
  expertiseAreas: z.array(z.string()).optional(),
  publicEmail: z.string().email('Please enter a valid email address.').or(z.literal('')).optional(),
  publicPhone: z.string().optional(),
    websiteUrl: z.string().optional().refine(
    (val) => {
      if (!val || val === '') return true;
      // Accept URLs with or without protocol prefix
      const urlToTest = val.match(/^https?:\/\//) ? val : `https://${val}`;
      return z.string().url().safeParse(urlToTest).success;
    },
    { message: 'Please enter a valid URL.' }
  ),
  socialLinks: z.object({
    facebook: z.string().optional(),
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
    instagram: z.string().optional(),
    youtube: z.string().optional(),
  }).optional(),
  awardsCertificates: z.array(
    z.object({
      title: z.string().min(1, 'Title is required.'),
      description: z.string().optional(),
    })
  ).optional(),
});

export type TeacherProfileFormValues = z.infer<typeof teacherProfileFormSchema>;