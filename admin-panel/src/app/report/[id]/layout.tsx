export const metadata = {
  title: 'Relatorio de Analise de Risco - SIMEops',
  description: 'Relatorio de criminalidade gerado por SIMEops',
};

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {children}
    </div>
  );
}
