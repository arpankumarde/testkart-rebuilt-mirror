export type ApiParam = {
  name: string;
  type: string;
  required: boolean;
  description: string;
};

export type ApiResponseField = {
  name: string;
  type: string;
  description: string;
};

export type ApiEndpoint = {
  method: "GET" | "POST";
  route: string;
  description: string;
  auth: "none" | "student" | "any";
  category: string;
  queryParams?: ApiParam[];
  bodyParams?: ApiParam[];
  responseFields: ApiResponseField[];
  notes?: string[];
};