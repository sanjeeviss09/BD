import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Plus, Edit2, Users } from 'lucide-react';

interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
  system_role: boolean;
  status: string;
}

export default function RoleManagement() {
  const { session } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/roles', {
          headers: { Authorization: `Bearer ${session?.access_token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setRoles(data);
        }
      } catch (error) {
        console.error('Failed to fetch roles', error);
      } finally {
        setLoading(false);
      }
    };
    if (session) fetchRoles();
  }, [session]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Role Management
          </h1>
          <p className="text-gray-500">Manage organization roles and system access.</p>
        </div>
        <button className="bg-primary text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Create Role
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">Loading roles...</td></tr>
            ) : roles.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No roles found.</td></tr>
            ) : (
              roles.map((role) => (
                <tr key={role.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{role.name}</div>
                    <div className="text-sm text-gray-500">{role.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{role.code}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${role.system_role ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                      {role.system_role ? 'System' : 'Custom'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${role.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {role.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-3">
                      <Link to={`/roles/${role.id}`} className="text-indigo-600 hover:text-indigo-900" title="Edit Permissions">
                        <Edit2 className="h-4 w-4" />
                      </Link>
                      <button className="text-gray-600 hover:text-gray-900" title="View Users">
                        <Users className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
