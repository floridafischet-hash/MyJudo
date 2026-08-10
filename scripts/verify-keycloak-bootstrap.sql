SELECT
  u.username,
  u.first_name,
  u.id AS identity_subject,
  kr.name AS realm_role
FROM user_entity u
JOIN user_role_mapping urm ON urm.user_id = u.id
JOIN keycloak_role kr ON kr.id = urm.role_id
JOIN realm re ON re.id = u.realm_id
WHERE re.name = 'myjudo'
  AND u.username IN ('florian', 'stefan')
  AND kr.name = 'superuser'
ORDER BY u.username;
