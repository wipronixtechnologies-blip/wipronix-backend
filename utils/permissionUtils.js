const DEFAULT_PERM_GROUPS = {
  base: ['Dashboard', 'Attendance', 'Leaves', 'Tasks', 'Profile', 'Chat', 'Team', 'Documents', 'Notifications', 'Requests', 'Activities'],
  hr: ['Staff', 'Performance', 'Resignation'],
  marketing: ['Marketing', 'Leads', 'Broadcast'],
  academic: ['Students', 'Courses', 'Trainers', 'TestResults', 'Admission'],
  placement: ['Placement', 'PlacementDrives', 'Internships'],
  sales: ['Bidding', 'Sales'],
  finance: ['Finance'],
  admin: ['AccessManagement', 'Settings', 'Goals', 'Colleges']
};

const ROLE_PERMISSIONS_MAPPING = {
  super_admin: 'all',
  admin: ['base', 'hr', 'marketing', 'academic', 'placement', 'sales', 'finance', 'admin'],
  hr: ['base', 'hr'],
  hr_manager: ['base', 'hr'],
  marketing_manager: ['base', 'marketing'],
  training_head: ['base', 'academic', 'placement'],
  bde: ['base', 'academic', 'marketing', 'sales'],
  bidder: ['base', 'sales'],
  project_manager: ['base', 'academic'],
  development_manager: ['base', 'academic'],
  operation_manager: ['base', 'finance'],
  staff: ['base'],
  employee: ['base']
};

// These are modules that should NOT be shown in the normal Access Management UI 
// because they are mandatory or handled automatically.
const MANDATORY_MODULES = [...DEFAULT_PERM_GROUPS.base];

const getMandatoryModulesForRole = (role) => {
  if (role === 'super_admin') return 'all';
  
  const groups = ROLE_PERMISSIONS_MAPPING[role] || ['base'];
  const modules = [];
  
  groups.forEach(group => {
    if (DEFAULT_PERM_GROUPS[group]) {
      modules.push(...DEFAULT_PERM_GROUPS[group]);
    }
  });
  
  return [...new Set(modules)];
};

const getDefaultPermissionsForRole = (role) => {
  const modules = getMandatoryModulesForRole(role);
  if (modules === 'all') return ['all'];
  
  // Format as module:read, module:write for mandatory modules
  const permissions = [];
  modules.forEach(module => {
    permissions.push(`${module}:read`);
    permissions.push(`${module}:write`);
    // Optional: maybe not delete for everyone? 
    // Usually full access for their own role's primary modules
    permissions.push(`${module}:delete`);
  });
  
  return permissions;
};

module.exports = {
  DEFAULT_PERM_GROUPS,
  ROLE_PERMISSIONS_MAPPING,
  MANDATORY_MODULES,
  getDefaultPermissionsForRole,
  getMandatoryModulesForRole
};
