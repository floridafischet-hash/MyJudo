const dataSource = require('/app/apps/api/dist/database/data-source').default;

dataSource
  .initialize()
  .then(() => dataSource.runMigrations())
  .then((migrations) => {
    console.log(migrations.map((migration) => migration.name).join(','));
    return dataSource.destroy();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
