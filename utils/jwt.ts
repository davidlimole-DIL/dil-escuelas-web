import { SignJWT, jwtVerify } from 'jose';

// Asegúrate de definir NEXT_PUBLIC_SUPABASE_ANON_KEY o alguna otra var como JWT_SECRET en .env.local
const secretKey = process.env.JWT_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const key = new TextEncoder().encode(secretKey);

export async function signAlumnoToken(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h') // Sesión de 2 horas para el alumno
    .sign(key);
}

export async function verifyAlumnoToken(input: string) {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    return null;
  }
}
