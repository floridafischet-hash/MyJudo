SELECT
  u.email,
  u."firstName",
  u.status,
  r.name AS role
FROM users u
JOIN user_roles ur ON ur."userId" = u.id
JOIN roles r ON r.id = ur."roleId"
WHERE lower(u.email) IN ('florian@myjudo.local', 'stefan@myjudo.local')
ORDER BY u.email, r.name;
