import { DashboardClient } from '../../../../components/DashboardClient';

interface RepositoryDashboardPageProps {
  params: Promise<{
    repositoryId: string;
  }>;
}

export default async function RepositoryDashboardPage({ params }: RepositoryDashboardPageProps) {
  const { repositoryId } = await params;
  return <DashboardClient initialRepositoryId={repositoryId} showRepositoryIndex={false} />;
}
