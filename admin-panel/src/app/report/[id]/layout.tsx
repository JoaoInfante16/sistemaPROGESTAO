export const metadata = {
  title: 'Relatorio de Analise de Risco - Netrios News',
  description: 'Relatorio de criminalidade gerado por Netrios News',
};

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {children}
    </div>
  );
}
