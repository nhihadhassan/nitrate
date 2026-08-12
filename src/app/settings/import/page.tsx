import { permanentRedirect } from 'next/navigation';

/**
 * The importer moved to `/import` so it can introduce itself to people who are
 * not signed in yet. This keeps every link that pointed at the settings path —
 * including ones already shared — working.
 */
export default function SettingsImportRedirect() {
  permanentRedirect('/import');
}
