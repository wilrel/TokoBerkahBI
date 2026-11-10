import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Page, PageHeader } from '@/components/ui/page';

export const metadata: Metadata = { title: 'Pelanggan' };

export default function CustomersPage() {
  return (
    <Page>
      <PageHeader title="Pelanggan" description="Data pelanggan, riwayat belanja, dan kasbon" />
      <Card>
        <EmptyState
          icon={Users}
          title="Fitur pelanggan sedang disiapkan"
          description="Nantinya Anda bisa mencatat pelanggan tetap, melihat riwayat belanja mereka, dan mengelola kasbon beserta jatuh temponya."
        />
      </Card>
    </Page>
  );
}
