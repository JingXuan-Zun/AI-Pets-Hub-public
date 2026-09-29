import { useEffect } from 'react';
import DesktopAreaPicker from './components/DesktopAreaPicker';

export default function DesktopAreaPickerApp() {
  useEffect(() => {
    const previousHtmlBackground = document.documentElement.style.background;
    const previousBodyBackground = document.body.style.background;
    const rootElement = document.getElementById('root');
    const previousRootBackground = rootElement?.style.background ?? '';

    document.documentElement.style.background = 'transparent';
    document.body.classList.add('desktop-shell');
    document.body.style.background = 'transparent';
    if (rootElement) {
      rootElement.style.background = 'transparent';
    }

    return () => {
      document.documentElement.style.background = previousHtmlBackground;
      document.body.style.background = previousBodyBackground;
      document.body.classList.remove('desktop-shell');
      if (rootElement) {
        rootElement.style.background = previousRootBackground;
      }
    };
  }, []);

  return <DesktopAreaPicker />;
}
