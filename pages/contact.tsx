import React from 'react';
import { Helmet } from 'react-helmet';
import { z } from 'zod';
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage } from '../components/Form';
import { Input } from '../components/Input';
import { Textarea } from '../components/Textarea';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';
import { useContactFormMutation } from '../helpers/useContactForm';
import { schema as contactFormSchema } from '../endpoints/contact/submit_POST.schema';
import { Mail, MapPin, Phone } from 'lucide-react';
import { WhatsAppBubble } from '../components/WhatsAppBubble';
import styles from './contact.module.css';

type ContactFormValues = z.infer<typeof contactFormSchema>;

const OFFICE_ADDRESS = '1st Floor, C-16, Block C, Sector 6, Noida, Uttar Pradesh 201301';
const OFFICE_MAP_URL = 'https://maps.app.goo.gl/N8WRNcAgkLkmeghj7';

const ContactPage: React.FC = () => {
  const form = useForm({
    schema: contactFormSchema,
    defaultValues: {
      name: '',
      email: '',
      subject: '',
      message: '',
    },
  });

  const contactMutation = useContactFormMutation();

  const onSubmit = (values: ContactFormValues) => {
    contactMutation.mutate(values, {
      onSuccess: () => {
        form.setValues({ name: '', email: '', subject: '', message: '' });
      },
    });
  };

  return (
    <>
      <Helmet>
        <title>Contact Us - Testkart</title>
        <meta name="description" content="Get in touch with the Testkart team. We're here to help with any questions or feedback you have." />
        <link rel="canonical" href="https://testkart.in/contact" />
      </Helmet>
      <div className={styles.pageWrapper}>
        <div className={styles.container}>
          <div className={styles.infoPanel}>
            <h1 className={styles.title}>Get in Touch</h1>
            <p className={styles.subtitle}>
              Have a question or feedback? Fill out the form and we'll get back to you as soon as possible.
            </p>
            <div className={styles.contactDetails}>
              <a className={styles.contactItem} href="tel:+919654548384">
                <Phone size={20} />
                <span>+91 96545 48384</span>
              </a>
              <a className={styles.contactItem} href="mailto:hello@testkart.in">
                <Mail size={20} />
                <span>hello@testkart.in</span>
              </a>
              <a
                className={`${styles.contactItem} ${styles.addressItem}`}
                href={OFFICE_MAP_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MapPin size={20} />
                <span>Communication Address: {OFFICE_ADDRESS}</span>
              </a>
            </div>
          </div>
          <div className={styles.formPanel}>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
                <FormItem name="name">
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="John Doe"
                      value={form.values.name}
                      onChange={(e) => form.setValues((prev) => ({ ...prev, name: e.target.value }))}
                      disabled={contactMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
                <FormItem name="email">
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="john.doe@example.com"
                      value={form.values.email}
                      onChange={(e) => form.setValues((prev) => ({ ...prev, email: e.target.value }))}
                      disabled={contactMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
                <FormItem name="subject">
                  <FormLabel>Subject (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Question about a test series"
                      value={form.values.subject}
                      onChange={(e) => form.setValues((prev) => ({ ...prev, subject: e.target.value }))}
                      disabled={contactMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
                <FormItem name="message">
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Your message here..."
                      rows={5}
                      value={form.values.message}
                      onChange={(e) => form.setValues((prev) => ({ ...prev, message: e.target.value }))}
                      disabled={contactMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
                <Button type="submit" size="lg" className={styles.submitButton} disabled={contactMutation.isPending}>
                  {contactMutation.isPending ? <Spinner size="sm" /> : 'Send Message'}
                </Button>
              </form>
            </Form>
          </div>
        </div>
        <WhatsAppBubble />
      </div>
    </>
  );
};

export default ContactPage;