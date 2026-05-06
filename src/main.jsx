import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import AssetPublicDetail from './pages/AssetPublicDetail.jsx'
import './index.css'

function Root() {
  const match = window.location.hash.match(/^#\/assets\/(.+)$/);
  if (match) return <AssetPublicDetail assetId={match[1]} />;
  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>
)