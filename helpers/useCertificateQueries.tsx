import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getStudentCertificatesList,
  OutputType as ListOutputType,
} from "../endpoints/student/certificates/list_GET.schema";
import {
  getTeacherCertificatesIssued,
  InputType as TeacherListInput,
  OutputType as TeacherListOutput,
} from "../endpoints/teacher/certificates/issued_GET.schema";
import {
  postStudentCertificateGenerate,
  InputType as GenerateInput,
} from "../endpoints/student/certificate/generate_POST.schema";
import {
  postStudentCertificateDownload,
  InputType as DownloadInput,
} from "../endpoints/student/certificate/download_POST.schema";

// --- Student Hooks ---

export const useStudentCertificates = () => {
  return useQuery<ListOutputType, Error>({
    queryKey: ["student", "certificates"],
    queryFn: () => getStudentCertificatesList(),
  });
};

export const useGenerateCertificate = () => {
  const queryClient = useQueryClient();
  return useMutation<Blob, Error, GenerateInput>({
    mutationFn: postStudentCertificateGenerate,
    onSuccess: () => {
      // Invalidate the list of certificates to refetch
      queryClient.invalidateQueries({ queryKey: ["student", "certificates"] });
    },
  });
};

export const useDownloadCertificate = () => {
  return useMutation<Blob, Error, DownloadInput>({
    mutationFn: postStudentCertificateDownload,
  });
};

// --- Teacher Hooks ---

export const useTeacherIssuedCertificates = (params: TeacherListInput) => {
  return useQuery<TeacherListOutput, Error>({
    queryKey: ["teacher", "certificates", params],
    queryFn: () => getTeacherCertificatesIssued(params),
    placeholderData: (previousData) => previousData,
  });
};