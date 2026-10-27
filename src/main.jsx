import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import AssetPublicDetail from './pages/AssetPublicDetail.jsx'
import './index.css'

function Root() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const match = hash.match(/^#\/assets\/(\d+)$/);   // QR = 바뀌지 않는 내부 키 (자산번호 아님)
  if (match) return <AssetPublicDetail assetId={match[1]} />;
  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>
)