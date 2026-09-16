import React, { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import { Form, FormItem, FormLabel, FormControl, FormMessage, useForm } from "./Form";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Button } from "./Button";
import { useCreateThreadMutation } from "../helpers/useTeacherSupport";
import { useSupportAttachmentUploads } from "../helpers/useSupportAttachmentUploads";
import { schema as createSchema, InputType } from "../endpoints/teacher/support/thread/create_POST.schema";
import { postTeacherSupportAttachmentUpload } from "../endpoints/teacher/support/attachments/upload_POST.schema";
import { SupportAttachButton, SupportPendingAttachments } from "./SupportAttachments";
import styles from "./TeacherSupportNewDialog.module.css";

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (id: number) => void;
}

export const TeacherSupportNewDialog: React.FC<Props> = ({
  isOpen,
  onOpenChange,
  onSuccess,
}) => {
  const createMutation = useCreateThreadMutation();
  const uploads = useSupportAttachmentUploads(postTeacherSupportAttachmentUpload);
  const { clear: clearAttachments } = uploads;

  const form = useForm({
    schema: createSchema,
    defaultValues: {
      subject: "",
      message: "",
    },
  });

  const { setValues } = form;
  useEffect(() => {
    if (isOpen) {
      setValues({ subject: "", message: "" });
      clearAttachments();
    }
  }, [isOpen, setValues, clearAttachments]);

  const onSubmit = async (values: InputType) => {
    if (uploads.isUploading || uploads.hasFailed) return;
    try {
      const newThread = await createMutation.mutateAsync({ ...values, attachments: uploads.attachments });
      onSuccess(newThread.id);
    } catch (error) {
      // Toast notification handles the error
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
          <DialogDescription>
            Start a new support thread with the Testkart team. We'll get back to you
            as soon as possible.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
            <FormItem name="subject">
              <FormLabel>Subject</FormLabel>
              <FormControl>
                <Input
                  placeholder="What is your question about?"
                  value={form.values.subject}
                  onChange={(e) =>
                    form.setValues((prev) => ({ ...prev, subject: e.target.value }))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="message">
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe your issue in detail..."
                  value={form.values.message}
                  onChange={(e) =>
                    form.setValues((prev) => ({ ...prev, message: e.target.value }))
                  }
                  rows={5}
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <div className={styles.attachments}>
              <SupportPendingAttachments items={uploads.items} onRemove={uploads.remove} />
              <div className={styles.attachRow}>
                <SupportAttachButton
                  onFiles={uploads.addFiles}
                  disabled={createMutation.isPending}
                  label="Attach files"
                />
                <span className={styles.attachHint}>Up to 5 files, 4 MB each</span>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || uploads.isUploading || uploads.hasFailed}
              >
                {createMutation.isPending ? "Sending..." : "Send Message"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};