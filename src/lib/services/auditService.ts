import { supabase } from '../supabase/client';

export const logAudit = async (
  projectId: string,
  userEmail: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, any> = {}
) => {
  const { error } = await supabase.from('audit_logs').insert({
    project_id: projectId,
    user_email: userEmail,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  });
  if (error) console.error('[auditService] Error:', error.message);
};
