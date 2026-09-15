import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { 
  useAdminCareersQuery, 
  useCreateCareerMutation, 
  useUpdateCareerMutation, 
  useDeleteCareerMutation 
} from "../helpers/useAdminCareers";
import { useAdminCareerApplications, useDeleteAdminCareerApplication } from "../helpers/useAdminCareerApplications";
import { CareerApplicationOutput } from "../endpoints/admin/careers/applications_GET.schema";
import { toast } from "sonner";
import { Selectable } from "kysely";
import { CareerPostings } from "../helpers/schema";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/Tabs";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Badge } from "../components/Badge";
import { Switch } from "../components/Switch";
import { Input } from "../components/Input";
import { RichTextEditor } from "../components/RichTextEditor";
import { DeleteConfirmationDialog } from "../components/DeleteConfirmationDialog";
import { Dialog } from "../components/Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "../components/ConsoleDialog";
import { Form, FormItem, FormLabel, FormControl, FormMessage, useForm } from "../components/Form";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "../components/Select";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { Plus, Edit2, Trash2, AlertCircle, Briefcase, FileText, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import styles from "./admin.careers.module.css";

// Form schemas for type safety and validation
const createCareerSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  department: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'internship'], {
    required_error: "Employment type is required"
  }),
  experienceLevel: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  requirements: z.string().optional(),
  salaryRange: z.string().optional(),
  isActive: z.boolean().default(true),
});

const editCareerSchema = z.object({
  id: z.number(),
  title: z.string().min(1, "Title is required").max(255),
  department: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'internship'], {
    required_error: "Employment type is required"
  }),
  experienceLevel: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  requirements: z.string().optional(),
  salaryRange: z.string().optional(),
  isActive: z.boolean(),
});

type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship';

const formatEmploymentType = (type: EmploymentType) => {
  return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const formatListDate = (date: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));

/* Shared by the loading and loaded tables so the columns do not jump. */
const PostingColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colTeam} />
    <col className={styles.colDate} />
    <col className={styles.colPostingActions} />
  </colgroup>
);

const ApplicationColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colContact} />
    <col className={styles.colResume} />
    <col className={styles.colDate} />
    <col className={styles.colApplicationActions} />
  </colgroup>
);

const StackSkeleton = ({ top, bottom }: { top: string; bottom: string }) => (
  <div className={styles.stack}>
    <Skeleton style={{ height: "0.875rem", width: top }} />
    <Skeleton style={{ height: "0.75rem", width: bottom }} />
  </div>
);

const PostingRowSkeleton = () => (
  <tr>
    <td><StackSkeleton top="50%" bottom="25%" /></td>
    <td><StackSkeleton top="70%" bottom="55%" /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "5rem" }} /></td>
    <td><Skeleton style={{ height: "1.5rem", width: "5.5rem", marginLeft: "auto" }} /></td>
  </tr>
);

const ApplicationRowSkeleton = () => (
  <tr>
    <td><StackSkeleton top="45%" bottom="60%" /></td>
    <td><StackSkeleton top="85%" bottom="55%" /></td>
    <td><Skeleton style={{ height: "1.5rem", width: "1.5rem" }} /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "5rem" }} /></td>
    <td><Skeleton style={{ height: "1.5rem", width: "1.5rem", marginLeft: "auto" }} /></td>
  </tr>
);

const CardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "9rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "6rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "2rem", width: "4rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

// --- Subcomponents ---

const CreateCareerForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const createMutation = useCreateCareerMutation();

  const form = useForm({
    schema: createCareerSchema,
    defaultValues: {
      title: "",
      department: "",
      location: "",
      employmentType: "full_time" as EmploymentType,
      experienceLevel: "",
      description: "",
      requirements: "",
      salaryRange: "",
      isActive: true,
    }
  });

  const onSubmit = (values: z.infer<typeof createCareerSchema>) => {
    createMutation.mutate(values, {
      onSuccess: () => onClose()
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <ConsoleDialogBody>
          <div className={styles.formGrid}>
            <FormItem name="title" className={styles.fullWidth}>
              <FormLabel>Job title</FormLabel>
              <FormControl>
                <Input
                  value={form.values.title}
                  onChange={(e) => form.setValues(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Senior Frontend Engineer"
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="department">
              <FormLabel>Department</FormLabel>
              <FormControl>
                <Input
                  value={form.values.department}
                  onChange={(e) => form.setValues(prev => ({ ...prev, department: e.target.value }))}
                  placeholder="e.g. Engineering"
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="location">
              <FormLabel>Location</FormLabel>
              <FormControl>
                <Input
                  value={form.values.location}
                  onChange={(e) => form.setValues(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g. Remote, India"
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="employmentType">
              <FormLabel>Employment type</FormLabel>
              <Select
                value={form.values.employmentType}
                onValueChange={(val) => form.setValues(prev => ({ ...prev, employmentType: val as EmploymentType }))}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="full_time">Full time</SelectItem>
                    <SelectItem value="part_time">Part time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>

            <FormItem name="experienceLevel">
              <FormLabel>Experience</FormLabel>
              <FormControl>
                <Input
                  value={form.values.experienceLevel}
                  onChange={(e) => form.setValues(prev => ({ ...prev, experienceLevel: e.target.value }))}
                  placeholder="e.g. 3-5 years"
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="salaryRange">
              <FormLabel>Salary range</FormLabel>
              <FormControl>
                <Input
                  value={form.values.salaryRange}
                  onChange={(e) => form.setValues(prev => ({ ...prev, salaryRange: e.target.value }))}
                  placeholder="e.g. ₹10-15 LPA"
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="isActive" className={styles.fullWidth}>
              <div className={styles.switchContainer}>
                <FormControl>
                  <Switch
                    id="create-is-active"
                    checked={form.values.isActive}
                    onCheckedChange={(checked) => form.setValues(prev => ({ ...prev, isActive: checked }))}
                  />
                </FormControl>
                <FormLabel htmlFor="create-is-active" className={styles.switchLabel}>
                  {form.values.isActive ? "Live on the careers page" : "Hidden from the careers page"}
                </FormLabel>
              </div>
              <FormMessage />
            </FormItem>

            <FormItem name="description" className={styles.fullWidth}>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <div>
                  <RichTextEditor
                    value={form.values.description}
                    onChange={(val) => form.setValues(prev => ({ ...prev, description: val }))}
                    placeholder="Describe the role..."
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="requirements" className={styles.fullWidth}>
              <FormLabel>Requirements</FormLabel>
              <FormControl>
                <div>
                  <RichTextEditor
                    value={form.values.requirements || ""}
                    onChange={(val) => form.setValues(prev => ({ ...prev, requirements: val }))}
                    placeholder="List the requirements..."
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          </div>
        </ConsoleDialogBody>

        <ConsoleDialogFooter>
          <Button variant="outline" type="button" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Adding..." : "Add job"}
          </Button>
        </ConsoleDialogFooter>
      </form>
    </Form>
  );
};

const EditCareerForm: React.FC<{ career: Selectable<CareerPostings>, onClose: () => void }> = ({ career, onClose }) => {
  const updateMutation = useUpdateCareerMutation();

  const form = useForm({
    schema: editCareerSchema,
    defaultValues: {
      id: career.id,
      title: career.title,
      department: career.department || "",
      location: career.location || "",
      employmentType: career.employmentType as EmploymentType,
      experienceLevel: career.experienceLevel || "",
      description: career.description,
      requirements: career.requirements || "",
      salaryRange: career.salaryRange || "",
      isActive: career.isActive,
    }
  });

  const onSubmit = (values: z.infer<typeof editCareerSchema>) => {
    updateMutation.mutate(values, {
      onSuccess: () => onClose()
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <ConsoleDialogBody>
          <div className={styles.formGrid}>
            <FormItem name="title" className={styles.fullWidth}>
              <FormLabel>Job title</FormLabel>
              <FormControl>
                <Input
                  value={form.values.title}
                  onChange={(e) => form.setValues(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Senior Frontend Engineer"
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="department">
              <FormLabel>Department</FormLabel>
              <FormControl>
                <Input
                  value={form.values.department}
                  onChange={(e) => form.setValues(prev => ({ ...prev, department: e.target.value }))}
                  placeholder="e.g. Engineering"
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="location">
              <FormLabel>Location</FormLabel>
              <FormControl>
                <Input
                  value={form.values.location}
                  onChange={(e) => form.setValues(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g. Remote, India"
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="employmentType">
              <FormLabel>Employment type</FormLabel>
              <Select
                value={form.values.employmentType}
                onValueChange={(val) => form.setValues(prev => ({ ...prev, employmentType: val as EmploymentType }))}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="full_time">Full time</SelectItem>
                    <SelectItem value="part_time">Part time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>

            <FormItem name="experienceLevel">
              <FormLabel>Experience</FormLabel>
              <FormControl>
                <Input
                  value={form.values.experienceLevel}
                  onChange={(e) => form.setValues(prev => ({ ...prev, experienceLevel: e.target.value }))}
                  placeholder="e.g. 3-5 years"
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="salaryRange">
              <FormLabel>Salary range</FormLabel>
              <FormControl>
                <Input
                  value={form.values.salaryRange}
                  onChange={(e) => form.setValues(prev => ({ ...prev, salaryRange: e.target.value }))}
                  placeholder="e.g. ₹10-15 LPA"
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="isActive" className={styles.fullWidth}>
              <div className={styles.switchContainer}>
                <FormControl>
                  <Switch
                    id="edit-is-active"
                    checked={form.values.isActive}
                    onCheckedChange={(checked) => form.setValues(prev => ({ ...prev, isActive: checked }))}
                  />
                </FormControl>
                <FormLabel htmlFor="edit-is-active" className={styles.switchLabel}>
                  {form.values.isActive ? "Live on the careers page" : "Hidden from the careers page"}
                </FormLabel>
              </div>
              <FormMessage />
            </FormItem>

            <FormItem name="description" className={styles.fullWidth}>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <div>
                  <RichTextEditor
                    value={form.values.description}
                    onChange={(val) => form.setValues(prev => ({ ...prev, description: val }))}
                    placeholder="Describe the role..."
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="requirements" className={styles.fullWidth}>
              <FormLabel>Requirements</FormLabel>
              <FormControl>
                <div>
                  <RichTextEditor
                    value={form.values.requirements || ""}
                    onChange={(val) => form.setValues(prev => ({ ...prev, requirements: val }))}
                    placeholder="List the requirements..."
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          </div>
        </ConsoleDialogBody>

        <ConsoleDialogFooter>
          <Button variant="outline" type="button" onClick={onClose} disabled={updateMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        </ConsoleDialogFooter>
      </form>
    </Form>
  );
};


// --- Main Page Component ---

const AdminCareers = () => {
  const { data, isFetching, error } = useAdminCareersQuery();
  const updateMutation = useUpdateCareerMutation();
  const deleteMutation = useDeleteCareerMutation();
  const applicationsQuery = useAdminCareerApplications();
  const deleteApplicationMutation = useDeleteAdminCareerApplication();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [careerToEdit, setCareerToEdit] = useState<Selectable<CareerPostings> | null>(null);
  const [careerToDelete, setCareerToDelete] = useState<Selectable<CareerPostings> | null>(null);
  const [applicationToDelete, setApplicationToDelete] = useState<CareerApplicationOutput | null>(null);

  const careers = data?.careers || [];

  const handleToggleStatus = (career: Selectable<CareerPostings>) => {
    updateMutation.mutate({
      id: career.id,
      isActive: !career.isActive
    });
  };

  const handleDelete = () => {
    if (careerToDelete) {
      deleteMutation.mutate({ id: careerToDelete.id }, {
        onSuccess: () => setCareerToDelete(null)
      });
    }
  };

  const handleDeleteApplication = () => {
    if (applicationToDelete) {
      deleteApplicationMutation.mutate(applicationToDelete.id, {
        onSuccess: () => {
          setApplicationToDelete(null);
          toast.success("Application deleted.");
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Could not delete the application.");
        }
      });
    }
  };

  const renderPostingIdentity = (career: Selectable<CareerPostings>) => (
    <div className={styles.stack}>
      <span className={styles.primaryLine}>
        <span className={styles.truncate} title={career.title}>{career.title}</span>
        {!career.isActive && (
          <Badge variant="secondary" className={styles.flag}>Inactive</Badge>
        )}
      </span>
      <span className={styles.secondaryLine}>
        {formatEmploymentType(career.employmentType as EmploymentType)}
      </span>
    </div>
  );

  const renderPostingActions = (career: Selectable<CareerPostings>) => (
    <div className={styles.rowActions}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.iconButton}
            onClick={() => handleToggleStatus(career)}
            disabled={updateMutation.isPending && updateMutation.variables?.id === career.id}
            aria-label={`${career.isActive ? "Deactivate" : "Activate"} ${career.title}`}
          >
            {career.isActive ? <EyeOff /> : <Eye />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{career.isActive ? "Deactivate" : "Activate"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.iconButton}
            onClick={() => setCareerToEdit(career)}
            aria-label={`Edit ${career.title}`}
          >
            <Edit2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Edit</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={`${styles.iconButton} ${styles.iconButtonDanger}`}
            onClick={() => setCareerToDelete(career)}
            aria-label={`Delete ${career.title}`}
          >
            <Trash2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete</TooltipContent>
      </Tooltip>
    </div>
  );

  const renderPostingsContent = () => {
    if (isFetching && careers.length === 0) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <PostingColumns />
              <tbody>
                {Array.from({ length: 4 }).map((_, i) => <PostingRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        </>
      );
    }

    if (error) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load the job postings"
          description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
        />
      );
    }

    if (careers.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<Briefcase size={24} />}
          title="No jobs posted yet"
          description="Jobs you post appear on the public careers page."
        >
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus size={16} /> Add a job
          </Button>
        </ConsoleListEmpty>
      );
    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <PostingColumns />
            <thead>
              <tr>
                <th>Job</th>
                <th>Team and location</th>
                <th>Posted</th>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {careers.map((career) => (
                <tr key={career.id}>
                  <td>{renderPostingIdentity(career)}</td>
                  <td>
                    <div className={styles.stack}>
                      <span
                        className={career.department ? styles.valueLine : styles.emptyLine}
                        title={career.department || undefined}
                      >
                        {career.department || "No team set"}
                      </span>
                      {career.location && (
                        <span className={styles.secondaryLine} title={career.location}>{career.location}</span>
                      )}
                    </div>
                  </td>
                  <td className={styles.date}>{formatListDate(career.createdAt)}</td>
                  <td>{renderPostingActions(career)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.cardsContainer}>
          {careers.map((career) => (
            <article key={career.id} className={styles.card}>
              <div className={styles.cardHeader}>
                {renderPostingIdentity(career)}
                {renderPostingActions(career)}
              </div>
              <dl className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <dt>Team</dt>
                  <dd className={career.department ? undefined : styles.empty}>{career.department || "No team set"}</dd>
                </div>
                {career.location && (
                  <div className={styles.cardStat}>
                    <dt>Location</dt>
                    <dd>{career.location}</dd>
                  </div>
                )}
                <div className={styles.cardStat}>
                  <dt>Posted</dt>
                  <dd>{formatListDate(career.createdAt)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </>
    );
  };

  const renderResume = (app: CareerApplicationOutput) =>
    app.resumeUrl ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={`${styles.iconButton} ${styles.inlineIconButton}`}
            onClick={() => window.open(app.resumeUrl!, "_blank", "noopener,noreferrer")}
            aria-label={`View the resume from ${app.name}`}
          >
            <FileText />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View resume</TooltipContent>
      </Tooltip>
    ) : (
      <span className={styles.emptyLine}>None attached</span>
    );

  const renderApplicationIdentity = (app: CareerApplicationOutput) => (
    <div className={styles.stack}>
      <span className={styles.primaryLine}>
        <span className={styles.truncate} title={app.name}>{app.name}</span>
      </span>
      <span className={styles.secondaryLine} title={app.careerTitle || undefined}>
        {app.careerTitle || "Job no longer listed"}
      </span>
    </div>
  );

  const renderApplicationActions = (app: CareerApplicationOutput) => (
    <div className={styles.rowActions}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={`${styles.iconButton} ${styles.iconButtonDanger}`}
            onClick={() => setApplicationToDelete(app)}
            aria-label={`Delete the application from ${app.name}`}
          >
            <Trash2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete</TooltipContent>
      </Tooltip>
    </div>
  );

  const renderApplicationsContent = () => {
    if (applicationsQuery.isFetching && !applicationsQuery.data) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <ApplicationColumns />
              <tbody>
                {Array.from({ length: 4 }).map((_, i) => <ApplicationRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        </>
      );
    }

    if (applicationsQuery.error) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load the applications"
          description={applicationsQuery.error instanceof Error ? applicationsQuery.error.message : "The request did not come back. Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => applicationsQuery.refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    const applications = applicationsQuery.data || [];

    if (applications.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<FileText size={24} />}
          title="No applications yet"
          description="People who apply for an open job appear here with their resume."
        />
      );
    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <ApplicationColumns />
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Contact</th>
                <th>Resume</th>
                <th>Applied</th>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id}>
                  <td>{renderApplicationIdentity(app)}</td>
                  <td>
                    <div className={styles.stack}>
                      <a href={`mailto:${app.email}`} className={styles.emailLink} title={app.email}>{app.email}</a>
                      {app.phone && (
                        <span className={`${styles.secondaryLine} ${styles.date}`}>{app.phone}</span>
                      )}
                    </div>
                  </td>
                  <td>{renderResume(app)}</td>
                  <td className={styles.date}>{formatListDate(app.createdAt)}</td>
                  <td>{renderApplicationActions(app)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.cardsContainer}>
          {applications.map((app) => (
            <article key={app.id} className={styles.card}>
              <div className={styles.cardHeader}>
                {renderApplicationIdentity(app)}
                {renderApplicationActions(app)}
              </div>
              <dl className={styles.cardStats}>
                <div className={`${styles.cardStat} ${styles.cardStatWide}`}>
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${app.email}`} className={styles.emailLink} title={app.email}>{app.email}</a>
                  </dd>
                </div>
                {app.phone && (
                  <div className={styles.cardStat}>
                    <dt>Phone</dt>
                    <dd>{app.phone}</dd>
                  </div>
                )}
                <div className={styles.cardStat}>
                  <dt>Applied</dt>
                  <dd>{formatListDate(app.createdAt)}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Resume</dt>
                  <dd>{renderResume(app)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </>
    );
  };

  return (
    <>
      <Helmet>
        <title>Careers - Testkart Admin</title>
      </Helmet>
      
      <div className={styles.page}>
        <ConsolePageHeader title="Careers">
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus size={16} /> Add a job
          </Button>
        </ConsolePageHeader>

        <Tabs defaultValue="postings" className={styles.tabs}>
          <TabsList className={styles.tabsList}>
            <TabsTrigger value="postings">Open jobs</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
          </TabsList>
          <div className={styles.tabsContentWrapper}>
            <TabsContent value="postings">
              <div className={styles.results}>{renderPostingsContent()}</div>
            </TabsContent>
            <TabsContent value="applications">
              <div className={styles.results}>{renderApplicationsContent()}</div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <ConsoleDialogContent size="lg">
          <ConsoleDialogHeader
            title="Add a job"
            description="It appears on the public careers page once it is active."
          />
          <CreateCareerForm onClose={() => setIsAddDialogOpen(false)} />
        </ConsoleDialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!careerToEdit} onOpenChange={(open) => !open && setCareerToEdit(null)}>
        <ConsoleDialogContent size="lg">
          <ConsoleDialogHeader
            title="Edit this job"
            description="Changes show on the careers page as soon as you save."
          />
          {careerToEdit && (
            <EditCareerForm
              career={careerToEdit}
              onClose={() => setCareerToEdit(null)}
            />
          )}
        </ConsoleDialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteConfirmationDialog
        isOpen={!!careerToDelete}
        onClose={() => setCareerToDelete(null)}
        onConfirm={handleDelete}
        isPending={deleteMutation.isPending}
        itemName={careerToDelete?.title}
        itemType="job posting"
      />

      {/* Delete Application Confirmation */}
      <DeleteConfirmationDialog
        isOpen={!!applicationToDelete}
        onClose={() => setApplicationToDelete(null)}
        onConfirm={handleDeleteApplication}
        isPending={deleteApplicationMutation.isPending}
        itemName={applicationToDelete?.name ? `application from ${applicationToDelete.name}` : undefined}
        itemType="application"
      />
    </>
  );
};

export default AdminCareers;
