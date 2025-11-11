import { useState } from 'react';
import { useGroups, useCreateGroup } from '../hooks/useGroups';
import { useAuthStore } from '../store/auth';

export default function Groups() {
  const { user } = useAuthStore();
  const { data: groups, isLoading } = useGroups();
  const createGroup = useCreateGroup();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !groupName.trim()) return;

    try {
      await createGroup.mutateAsync({
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
        owner_id: user.id,
      });
      setGroupName('');
      setGroupDescription('');
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create group:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="mx-auto max-w-6xl">
          <div className="text-center py-12">
            <div className="text-gray-500">Loading groups...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Groups</h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            {showCreateForm ? 'Cancel' : 'Create Group'}
          </button>
        </div>

        {/* Create Group Form */}
        {showCreateForm && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Create New Group</h2>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Group Name *
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="Study Group, Weekend Hangout, etc."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="What's this group about?"
                  rows={3}
                />
              </div>
              <button
                type="submit"
                disabled={createGroup.isPending}
                className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createGroup.isPending ? 'Creating...' : 'Create Group'}
              </button>
            </form>
          </div>
        )}

        {/* Groups List */}
        <div className="space-y-4">
          {!groups || groups.length === 0 ? (
            <div className="rounded-lg bg-white p-8 text-center shadow">
              <p className="text-gray-500">
                No groups yet. Create one to get started!
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                className="rounded-lg bg-white p-6 shadow hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {group.name}
                    </h3>
                    {group.description && (
                      <p className="mt-2 text-gray-600">{group.description}</p>
                    )}
                    <p className="mt-2 text-sm text-gray-500">
                      Created {new Date(group.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <a
                    href={`/groups/${group.id}`}
                    className="ml-4 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200"
                  >
                    View Details
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
