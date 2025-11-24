export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Login page doesn't need the admin layout, just render children directly
  return <>{children}</>;
}
