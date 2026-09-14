export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            const preference = localStorage.getItem('chatkit-color-scheme');
            const scheme = preference === 'dark' || preference === 'light' 
              ? preference 
              : window.matchMedia('(prefers-color-scheme: dark)').matches 
                ? 'dark' 
                : 'light';
            
            document.documentElement.dataset.colorScheme = scheme;
            document.documentElement.classList.toggle('dark', scheme === 'dark');
            document.documentElement.style.colorScheme = scheme;
          })();
        `,
      }}
    />
  );
}
