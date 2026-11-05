export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">404 - Page Not Found</h2>
      <p className="mt-2 text-muted-foreground">The requested page could not be found.</p>
      <a href="/" className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90">
        Return Home
      </a>
    </div>
  );
}
