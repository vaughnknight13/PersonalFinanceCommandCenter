import { useAppData } from '../hooks/useAppData';

// Shows the last storage error (for example, "storage is full") if there is one.
export default function StoreMessage() {
  const { message } = useAppData();
  if (message === '') {
    return null;
  }
  return (
    <p role="alert" className="notice notice--error">
      {message}
    </p>
  );
}