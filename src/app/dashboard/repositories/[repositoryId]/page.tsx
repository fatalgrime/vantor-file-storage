import { DashboardClient } from '../../../../components/DashboardClient';

interface RepositoryDashboardPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
  params: Promise<{
    repositoryId: string;
  }>;
}

export default async function RepositoryDashboardPage({ params, searchParams }: RepositoryDashboardPageProps) {
  const { repositoryId } = await params;
  const { q } = await searchParams;
  return <DashboardClient initialSearchQuery={typeof q === 'string' ? q : ''} initialRepositoryId={repositoryId} showRepositoryIndex={false} />;
}
