import { useState, useEffect } from 'react'
import { TripProvider, useTripStore } from './store/tripStore'
import HomePage from './pages/HomePage'
import TxDetailPage from './pages/TxDetailPage'
import CameraPage from './pages/CameraPage'
import DigitalBillPage from './pages/DigitalBillPage'
import SplitTargetPage from './pages/SplitTargetPage'
import SplitMethodPage from './pages/SplitMethodPage'
import SplitConfigPage from './pages/SplitConfigPage'
import SettlementPage from './pages/SettlementPage'
import SentPage from './pages/SentPage'

function AppContent() {
  const { state, dispatch } = useTripStore()
  const [screen, setScreen] = useState('home')
  const [backendOk, setBackendOk] = useState(true)

  useEffect(() => {
    fetch('/api/health')
      .then(r => setBackendOk(r.ok))
      .catch(() => setBackendOk(false))
  }, [])

  function navigate(to) {
    setScreen(to)
    window.scrollTo(0, 0)
  }

  // Determine where "Back" from split-target goes
  const splitTargetBack = state.flow?.bill ? 'digital-bill' : 'tx-detail'

  const offlineBanner = !backendOk && (
    <div style={{ background: '#ff453a22', color: '#ff453a' }}
      className="text-xs text-center py-2 px-4 sticky top-0 z-50">
      Backend offline — AI extraction and payment requests won't work
    </div>
  )

  const screens = {
    home: (
      <HomePage
        onTxSelect={tx => {
          dispatch({ type: 'START_FLOW', payload: { tx } })
          navigate('tx-detail')
        }}
        onReset={() => {
          if (confirm('Reset app? Session data will be cleared.')) {
            localStorage.removeItem('bunq_splitter_v2')
            dispatch({ type: 'RESET' })
          }
        }}
      />
    ),
    'tx-detail': (
      <TxDetailPage
        onBack={() => navigate('home')}
        onAddReceipt={() => navigate('camera')}
        onSplit={() => navigate('split-target')}
      />
    ),
    camera: (
      <CameraPage
        onBack={() => navigate('tx-detail')}
        onBillExtracted={() => navigate('digital-bill')}
      />
    ),
    'digital-bill': (
      <DigitalBillPage
        onBack={() => navigate('tx-detail')}
        onSplit={() => navigate('split-target')}
      />
    ),
    'split-target': (
      <SplitTargetPage
        onBack={() => navigate(splitTargetBack)}
        onNext={() => navigate('split-method')}
      />
    ),
    'split-method': (
      <SplitMethodPage
        onBack={() => navigate('split-target')}
        onNext={() => navigate('split-config')}
      />
    ),
    'split-config': (
      <SplitConfigPage
        onBack={() => navigate('split-method')}
        onNext={() => navigate('settlement')}
      />
    ),
    settlement: (
      <SettlementPage
        onBack={() => navigate('split-config')}
        onDone={() => navigate('sent')}
      />
    ),
    sent: (
      <SentPage
        onDone={() => {
          dispatch({ type: 'RESET_FLOW' })
          navigate('home')
        }}
      />
    ),
  }

  return (
    <div className="flex flex-col min-h-svh" style={{ background: '#111111' }}>
      {offlineBanner}
      {screens[screen] ?? screens.home}
    </div>
  )
}

export default function App() {
  return (
    <TripProvider>
      <AppContent />
    </TripProvider>
  )
}
