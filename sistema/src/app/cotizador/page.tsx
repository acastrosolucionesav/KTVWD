import { verifySession } from '@/lib/dal';
import CotizadorForm from './CotizadorForm';

export default async function CotizadorPage() {
  await verifySession();
  return <CotizadorForm />;
}
