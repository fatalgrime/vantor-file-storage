import { DashboardClient } from '../../../../components/DashboardClient';

interface RepositoryDashboardPageProps {
  searchParams: Promise<{ q?: string | string[]; folder?: string | string[] }>;
  params: Promise<{
    repositoryId: string;
  }>;
}

export default async function RepositoryDashboardPage({ params, searchParams }: RepositoryDashboardPageProps) {
  const { repositoryId } = await params;
  const { q, folder } = await searchParams;
  return <DashboardClient initialFolderId={typeof folder === 'string' ? folder : undefined} initialSearchQuery={typeof q === 'string' ? q : ''} initialRepositoryId={repositoryId} showRepositoryIndex={false} />;
}
