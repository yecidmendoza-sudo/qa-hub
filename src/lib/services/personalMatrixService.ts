import { supabase } from '../supabase/client';

/**
 * Elimina una versión de matriz personal.
 * Si es la única versión del folder, elimina también el folder.
 */
export const deletePersonalMatrixVersion = async (
  versionId: string,
  folderId: string
): Promise<{ folderDeleted: boolean }> => {
  // Contar cuántas versiones quedan en el folder
  const { count } = await supabase
    .from('personal_matrix_versions')
    .select('id', { count: 'exact', head: true })
    .eq('folder_id', folderId);

  // Borrar la versión
  const { error: vErr } = await supabase
    .from('personal_matrix_versions')
    .delete()
    .eq('id', versionId);

  if (vErr) throw vErr;

  // Si era la única versión, borrar también el folder
  if ((count ?? 0) <= 1) {
    const { error: fErr } = await supabase
      .from('personal_matrix_folders')
      .delete()
      .eq('id', folderId);
    if (fErr) throw fErr;
    return { folderDeleted: true };
  }

  return { folderDeleted: false };
};

/**
 * Elimina un folder completo (todas sus versiones + el folder).
 */
export const deletePersonalMatrixFolder = async (
  folderId: string
): Promise<void> => {
  // Borrar todas las versiones del folder primero
  const { error: vErr } = await supabase
    .from('personal_matrix_versions')
    .delete()
    .eq('folder_id', folderId);

  if (vErr) throw vErr;

  // Borrar el folder
  const { error: fErr } = await supabase
    .from('personal_matrix_folders')
    .delete()
    .eq('id', folderId);

  if (fErr) throw fErr;
};

/**
 * Actualiza las notas de una versión de matriz personal.
 */
export const updatePersonalMatrixVersionNotes = async (
  versionId: string,
  notes: string
): Promise<void> => {
  const { error } = await supabase
    .from('personal_matrix_versions')
    .update({ notes })
    .eq('id', versionId);

  if (error) throw error;
};
