import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, ArrowLeft, Save } from 'lucide-react';

export default function RoleEditor() {
  const { id } = useParams();
  const { session } = useAuth();
  const [role, setRole] = useState<any>(null);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rolesRes, permsRes] = await Promise.all([
          fetch('http://localhost:4000/api/roles', { headers: { Authorization: `Bearer ${session?.access_token}` } }),
          fetch('http://localhost:4000/api/permissions', { headers: { Authorization: `Bearer ${session?.access_token}` } })
        ]);

        if (rolesRes.ok && permsRes.ok) {
          const roles = await rolesRes.json();
          const perms = await permsRes.json();
          const targetRole = roles.find((r: any) => r.id === id);
          
          setRole(targetRole);
          setAllPermissions(perms);
          
          if (targetRole && targetRole.role_permissions) {
            const currentPerms = targetRole.role_permissions.map((rp: any) => rp.permissions.id);
            setSelectedPermissions(currentPerms);
          }
        }
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        setLoading(false);
      }
    };
    if (session) fetchData();
  }, [id, session]);

  const togglePermission = (permId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
  };

  const savePermissions = async () => {
    try {
      const res = await fetch(`http://localhost:4000/api/roles/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ permission_ids: selectedPermissions })
      });
      if (res.ok) alert('Permissions saved successfully!');
      else alert('Failed to save permissions.');
    } catch (error) {
      console.error(error);
    }
  };

  const groupedPermissions = allPermissions.reduce((acc: any, perm: any) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {});

  if (loading) return <div className="p-6">Loading editor...</div>;
  if (!role) return <div className="p-6">Role not found</div>;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/roles" className="text-gray-500 hover:text-gray-900 flex items-center gap-1 mb-2 text-sm">
            <ArrowLeft className="h-4 w-4" /> Back to Roles
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Edit Role: {role.name}
          </h1>
          <p className="text-gray-500">{role.description}</p>
        </div>
        {!role.system_role && (
          <button onClick={savePermissions} className="bg-primary text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-primary/90">
            <Save className="h-4 w-4" /> Save Permissions
          </button>
        )}
      </div>

      {role.system_role && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-md mb-6">
          This is a system-managed role. Permissions cannot be modified directly.
        </div>
      )}

      <div className="space-y-6">
        {Object.keys(groupedPermissions).map(category => (
          <div key={category} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900">{category}</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedPermissions[category].map((perm: any) => (
                <label key={perm.id} className={`flex items-start gap-3 p-3 border rounded-md ${role.system_role ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}>
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    checked={selectedPermissions.includes(perm.id)}
                    onChange={() => togglePermission(perm.id)}
                    disabled={role.system_role}
                  />
                  <div>
                    <div className="font-medium text-gray-900">{perm.name}</div>
                    <div className="text-sm text-gray-500">{perm.description}</div>
                    <div className="text-xs text-gray-400 mt-1 font-mono">{perm.code}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
