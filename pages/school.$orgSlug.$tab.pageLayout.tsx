import { SharedLayout } from '../components/SharedLayout';
import { OrganizationProfileLayout } from '../components/OrganizationProfileLayout';

// Shared by every organisation route so the profile stays mounted between sections.
export default [SharedLayout, OrganizationProfileLayout];