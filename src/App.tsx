import { HashRouter, Route, Routes } from 'react-router-dom'
import { CalendarPage } from './pages/CalendarPage.tsx'
import { CardDetailPage } from './pages/CardDetailPage.tsx'
import { CardFormPage } from './pages/CardFormPage.tsx'
import { CardsPage } from './pages/CardsPage.tsx'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { ImportPage } from './pages/ImportPage.tsx'
import { PracticePage } from './pages/PracticePage.tsx'
import { ProgressPage } from './pages/ProgressPage.tsx'
import { SettingsPage } from './pages/SettingsPage.tsx'
import { StudyPage } from './pages/StudyPage.tsx'
import { AppShell } from './ui/AppShell.tsx'
import { DbGate } from './ui/DbGate.tsx'

export default function App() {
  return (
    <DbGate>
      <HashRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/study" element={<StudyPage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/practice/:type" element={<PracticePage />} />
            <Route path="/cards" element={<CardsPage />} />
            <Route path="/cards/new" element={<CardFormPage />} />
            <Route path="/cards/:id/edit" element={<CardFormPage />} />
            <Route path="/cards/:id" element={<CardDetailPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </AppShell>
      </HashRouter>
    </DbGate>
  )
}
