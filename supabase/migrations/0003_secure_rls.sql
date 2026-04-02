-- =========================================================================
-- PARCHE DE SEGURIDAD PARA POLÍTICAS RLS EN SUPABASE
-- =========================================================================
-- Al ejecutar este script en tu panel de SQL de Supabase (SQL Editor),
-- te asegurarás de que ningún usuario pueda descargar ni ver la
-- información (viajes, gastos, etc.) de otros usuarios.

-- 1. Asegurarnos que RLS esté activado
ALTER TABLE public.viajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospedajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actividades ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar todas las políticas "anon_all" y "auth_all" abiertas anteriores que permitían fuga de datos
DROP POLICY IF EXISTS anon_all_viajes ON public.viajes;
DROP POLICY IF EXISTS auth_all_viajes ON public.viajes;

DROP POLICY IF EXISTS anon_all_categorias ON public.categorias;
DROP POLICY IF EXISTS auth_all_categorias ON public.categorias;

DROP POLICY IF EXISTS anon_all_gastos ON public.gastos;
DROP POLICY IF EXISTS auth_all_gastos ON public.gastos;

DROP POLICY IF EXISTS anon_all_itinerarios ON public.itinerarios;
DROP POLICY IF EXISTS auth_all_itinerarios ON public.itinerarios;

DROP POLICY IF EXISTS anon_all_hospedajes ON public.hospedajes;
DROP POLICY IF EXISTS auth_all_hospedajes ON public.hospedajes;

DROP POLICY IF EXISTS anon_all_presupuestos ON public.presupuestos;
DROP POLICY IF EXISTS auth_all_presupuestos ON public.presupuestos;

DROP POLICY IF EXISTS anon_all_actividades ON public.actividades;
DROP POLICY IF EXISTS auth_all_actividades ON public.actividades;

-- 3. Crear políticas estrictas por usuario logueado (solo ver y modificar lo propio)
CREATE POLICY auth_viajes ON public.viajes 
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY auth_gastos ON public.gastos 
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY auth_itinerarios ON public.itinerarios 
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY auth_hospedajes ON public.hospedajes 
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY auth_presupuestos ON public.presupuestos 
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY auth_actividades ON public.actividades 
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 4. Excepción para la tabla Categorias: los usuarios pueden leer sus categorias O las categorias por defecto del sistema (user_id IS NULL)
CREATE POLICY auth_read_categorias ON public.categorias 
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY auth_write_categorias ON public.categorias 
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
