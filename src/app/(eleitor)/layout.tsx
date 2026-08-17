export default function LayoutEleitor({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-concreto">
      {children}
      <footer className="px-5 pb-8 pt-4 text-center text-xs text-grafite-claro">
        Votação eletrônica sigilosa · NR-05 / NR-31
      </footer>
    </div>
  );
}
