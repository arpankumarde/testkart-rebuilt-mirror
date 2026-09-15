import React from "react";

export const AdminLayoutContext = React.createContext<{
  setHeaderHidden: (hidden: boolean) => void;
}>({ setHeaderHidden: () => {} });

export const useAdminLayout = () => React.useContext(AdminLayoutContext);