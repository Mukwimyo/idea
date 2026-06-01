import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const uploadFile = async (file, path) => {
  const { data, error } = await supabase.storage
    .from('idea-uploads')
    .upload(path, file, { upsert: true })
  if (error) return null
  const { data: { publicUrl } } = supabase.storage
    .from('idea-uploads')
    .getPublicUrl(path)
  return publicUrl
}