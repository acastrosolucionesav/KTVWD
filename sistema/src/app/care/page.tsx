import { verifySession } from '@/lib/dal';
import CareForm from './CareForm';

export default async function CarePage() {
  await verifySession();
  return <CareForm />;
}
