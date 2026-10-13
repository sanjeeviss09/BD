import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export default function AccessDenied() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-gray-900">
            Access Denied
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            You do not have the required permissions to access this enterprise resource.
            Please contact your organization administrator if you believe this is an error.
          </p>
          <div className="mt-6">
            <Link
              to="/dashboard"
              className="flex w-full justify-center rounded-md border border-transparent bg-primary py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
