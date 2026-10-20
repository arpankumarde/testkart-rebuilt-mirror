import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { z } from 'zod';
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage } from '../components/Form';
import { Input } from '../components/Input';
import { Textarea } from '../components/Textarea';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';
import { useContactFormMutation } from '../helpers/useContactForm';
import { parseErrorMessage } from '../helpers/parseErrorMessage';
import { schema as contactFormSchema } from '../endpoints/contact/submit_POST.schema';
import { AlertCircle, CheckCircle2, ExternalLink, Mail, MapPin, Phone, Send } from 'lucide-react';
import { WhatsAppBubble } from '../components/WhatsAppBubble';
import styles from './contact.module.css';

type ContactFormValues = z.infer<typeof contactFormSchema>;

const PHONE_DISPLAY = '+91 96545 48384';
const PHONE_HREF = 'tel:+919654548384';
const EMAIL = 'hello@testkart.in';
const OFFICE_ADDRESS_LINES = ['1st Floor, C-16, Block C, Sector 6,', 'Noida, Uttar Pradesh 201301'];
const OFFICE_MAP_URL = 'https://maps.app.goo.gl/N8WRNcAgkLkmeghj7';
const MESSAGE_MAX = 5000;

const EMPTY_VALUES: ContactFormValues = { name: '', email: '', subject: '', message: '' };

const ContactPage: React.FC = () => {
  const form = useForm({
    schema: contactFormSchema,
    defaultValues: EMPTY_VALUES,
  });

  const contactMutation = useContactFormMutation();
  const [sentTo, setSentTo] = useState<{ name: string; email: string } | null>(null);
  const isSending = contactMutation.isPending;

  // Editing after a result clears the success or error banner.
  const update = (field: keyof ContactFormValues, value: string) => {
    if (contactMutation.isSuccess || contactMutation.isError) contactMutation.reset();
    form.setValues((prev) => ({ ...prev, [field]: value }));
  };

  const onSubmit = (values: ContactFormValues) => {
    contactMutation.mutate(values, {
      onSuccess: () => {
        setSentTo({ name: values.name.trim(), email: values.email.trim() });
        form.setValues(EMPTY_VALUES);
      },
    });
  };

  const firstName = sentTo?.name.split(/\s+/)[0];

  return (
    <>
      <Helmet>
        <title>Contact Us - Testkart</title>
        <meta name="description" content="Get in touch with the Testkart team. We're here to help with any questions or feedback you have." />
        <link rel="canonical" href="https://testkart.in/contact" />
      </Helmet>
      <div className={styles.pageWrapper}>
        <div className={styles.container}>
          <section className={styles.infoPanel} aria-labelledby="contact-title">
            <span className={styles.eyebrow}>Contact us</span>
            <h1 id="contact-title" className={styles.title}>Get in Touch</h1>
            <p className={styles.subtitle}>
              Have a question or feedback? We'd love to hear from you.
            </p>

            <ul className={styles.contactList}>
              <li>
                <a className={`${styles.contactItem} ${styles.toneBlue}`} href={PHONE_HREF}>
                  <span className={styles.contactIcon} aria-hidden="true"><Phone size={20} /></span>
                  <span className={styles.contactText}>
                    <span className={styles.contactLabel}>Call us</span>
                    <span className={styles.contactValue}>{PHONE_DISPLAY}</span>
                  </span>
                </a>
              </li>
              <li>
                <a className={`${styles.contactItem} ${styles.toneLavender}`} href={`mailto:${EMAIL}`}>
                  <span className={styles.contactIcon} aria-hidden="true"><Mail size={20} /></span>
                  <span className={styles.contactText}>
                    <span className={styles.contactLabel}>Email us</span>
                    <span className={styles.contactValue}>{EMAIL}</span>
                  </span>
                </a>
              </li>
              <li>
                <a
                  className={`${styles.contactItem} ${styles.toneSage}`}
                  href={OFFICE_MAP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className={styles.contactIcon} aria-hidden="true"><MapPin size={20} /></span>
                  <span className={styles.contactText}>
                    <span className={styles.contactLabel}>Communication address</span>
                    <span className={styles.contactAddress}>
                      {OFFICE_ADDRESS_LINES.map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </span>
                    <span className={styles.mapHint}>
                      Open in Google Maps <ExternalLink size={13} aria-hidden="true" />
                      <span className={styles.srOnly}> (opens in a new tab)</span>
                    </span>
                  </span>
                </a>
              </li>
            </ul>
          </section>

          <section className={styles.formCard} aria-labelledby="contact-form-title">
            <div className={styles.formHead}>
              <h2 id="contact-form-title" className={styles.formTitle}>Send us a message</h2>
              <p className={styles.formIntro}>Fill in the form and our team will reply by email.</p>
            </div>

            {contactMutation.isSuccess && sentTo && (
              <div className={`${styles.notice} ${styles.noticeSuccess}`} role="status">
                <CheckCircle2 size={20} aria-hidden="true" />
                <div>
                  <p className={styles.noticeTitle}>Message sent</p>
                  <p className={styles.noticeText}>
                    Thanks{firstName ? `, ${firstName}` : ''}! We'll get back to you at <strong>{sentTo.email}</strong> soon.
                  </p>
                </div>
              </div>
            )}

            {contactMutation.isError && (
              <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
                <AlertCircle size={20} aria-hidden="true" />
                <div>
                  <p className={styles.noticeTitle}>Your message could not be sent</p>
                  <p className={styles.noticeText}>
                    {parseErrorMessage(contactMutation.error) || 'Something went wrong.'} Please try again, or email us at{' '}
                    <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
                  </p>
                </div>
              </div>
            )}

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className={styles.form}
                aria-busy={isSending}
                noValidate
              >
                <div className={styles.fieldRow}>
                  <FormItem name="name" className={styles.field}>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input
                        className={styles.input}
                        placeholder="e.g. Riya Sharma"
                        autoComplete="name"
                        value={form.values.name}
                        onChange={(e) => update('name', e.target.value)}
                        disabled={isSending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                  <FormItem name="email" className={styles.field}>
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <Input
                        className={styles.input}
                        type="email"
                        inputMode="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        value={form.values.email}
                        onChange={(e) => update('email', e.target.value)}
                        disabled={isSending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </div>

                <FormItem name="subject" className={styles.field}>
                  <FormLabel>
                    Subject <span className={styles.optional}>(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      className={styles.input}
                      placeholder="e.g. Question about a test series"
                      value={form.values.subject}
                      onChange={(e) => update('subject', e.target.value)}
                      disabled={isSending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="message" className={styles.field}>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      className={styles.textarea}
                      placeholder="Tell us how we can help..."
                      rows={6}
                      maxLength={MESSAGE_MAX}
                      value={form.values.message}
                      onChange={(e) => update('message', e.target.value)}
                      disabled={isSending}
                    />
                  </FormControl>
                  <div className={styles.messageMeta}>
                    <FormMessage />
                    <span className={styles.counter} aria-hidden="true">
                      {form.values.message.length} / {MESSAGE_MAX}
                    </span>
                  </div>
                </FormItem>

                <Button type="submit" size="lg" className={styles.submitButton} disabled={isSending}>
                  {isSending ? (
                    <>
                      <Spinner size="sm" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send size={18} aria-hidden="true" /> Send Message
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </section>
        </div>
        <WhatsAppBubble />
      </div>
    </>
  );
};

export default ContactPage;
