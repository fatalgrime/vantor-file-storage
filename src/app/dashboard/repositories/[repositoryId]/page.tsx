import { DashboardClient } from '../../../../components/DashboardClient';

interface RepositoryDashboardPageProps {
  params: {
    repositoryId: string;
  };
}

export default function RepositoryDashboardPage({ params }: RepositoryDashboardPageProps) {
  return <DashboardClient initialRepositoryId={params.repositoryId} showRepositoryIndex={false} />;
}
