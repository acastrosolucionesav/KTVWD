import { verifySession } from '@/lib/dal';
import MaterialesForm from './MaterialesForm';

export default async function MaterialesPage() {
  await verifySession();
  return <MaterialesForm />;
}
