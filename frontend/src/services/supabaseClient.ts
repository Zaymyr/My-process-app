import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://arpcmjyqsjqvxgmnbnqm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFycGNtanlxc2pxdnhnbW5ibnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwNTYyMjMsImV4cCI6MjA3MjYzMjIyM30.eS2Cy6TszBr43ZXcCxca5rDYfMl9KIIi7xIvjIIASiw';

export const supabase = createClient(supabaseUrl, supabaseKey);
