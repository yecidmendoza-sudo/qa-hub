import { BookOpen, Rocket, Bot, Layout, Plug, HelpCircle, FlaskConical, Cpu } from 'lucide-react';

interface Section {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SECTIONS: Section[] = [
  { id: 'quick-start',    label: 'Quick Start',          icon: Rocket },
  { id: 'gideon-skills',  label: 'Gideon — Skills',      icon: Bot },
  { id: 'mas',            label: 'MAS — Multi-Agent',    icon: Cpu },
  { id: 'qa-hub-ui',      label: 'QA Hub — Interfaz',    icon: Layout },
  { id: 'api-reference',  label: 'API Reference',        icon: Plug },
  { id: 'api-playground', label: 'API Playground',       icon: FlaskConical },
  { id: 'faq',            label: 'FAQ',                  icon: HelpCircle },
];

export default function DocsNav() {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className="w-56 flex-shrink-0">
      <div className="sticky top-6 bg-white border border-gray-200 rounded-xl shadow-sm p-3 space-y-0.5">
        <div className="flex items-center gap-2 px-3 py-2 mb-2 border-b border-gray-100">
          <BookOpen className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-bold text-gray-800">Contenido</span>
        </div>
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => scrollTo(id)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors text-left"
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
