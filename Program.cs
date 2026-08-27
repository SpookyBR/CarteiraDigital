using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOpenApi();

//Suporte no Sqlite
builder.Services.AddDbContext<AppDbContext>(option =>
    option.UseSqlite("Data Source=carteira.db"));

builder.Services.AddCors(options =>
{
    options.AddPolicy("PermitirFrontend", policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});
var app = builder.Build();

app.UseCors("PermitirFrontend");

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

app.MapOpenApi();

//Cadastro
app.MapPost("/usuarios", async (Usuario novoUsuario, AppDbContext db) =>
{
    if (string.IsNullOrEmpty(novoUsuario.Nome))
    {
        return Results.BadRequest("Nome de usuario invalido");
    }
    novoUsuario.Saldo = 0;
    db.Usuarios.Add(novoUsuario);
    await db.SaveChangesAsync();
    return Results.Json(novoUsuario, statusCode: 201);
});

//Busca de Usuarios
app.MapGet("/usuarios", async (AppDbContext db) =>
    Results.Ok(await db.Usuarios.ToListAsync()));

//Deposito
app.MapPost("/carteira/deposito", async (OperacaoFinanceira operacao, AppDbContext db) =>
{
    var usuario = await db.Usuarios.FindAsync(operacao.UsuarioId);

    if (usuario == null) return Results.NotFound("Usuário não encontrado.");
    if (operacao.Valor <= 0) return Results.BadRequest("O valor do deposito inválido");

    usuario.Saldo += operacao.Valor;
    await db.SaveChangesAsync();

    return Results.Ok(new { mensagem = $"Depósito de R${operacao.Valor} realizado com sucesso!", saldoAtual = usuario.Saldo });

});

//Saque
app.MapPost("/carteira/saque", async (OperacaoFinanceira operacao, AppDbContext db) =>
{
    var usuario = await db.Usuarios.FindAsync(operacao.UsuarioId);

    if (usuario == null) return Results.NotFound("Usuário não encontrado.");
    if (operacao.Valor <= 0) return Results.BadRequest("O valor do saque inválido");

    if (usuario.Saldo < operacao.Valor)
    {
        return Results.BadRequest("Saldo insuficiente.");
    }

    usuario.Saldo -= operacao.Valor;
    await db.SaveChangesAsync();

    return Results.Ok(new { mensagem = $"Saque de R${operacao.Valor} realizado." });

});

//Transferencia
app.MapPost("/carteira/transferencia", async (PedidoTransferencia pedido, AppDbContext db) =>
{
    var origem = await db.Usuarios.FindAsync(pedido.OrigemUsuarioId);
    var destino = await db.Usuarios.FindAsync(pedido.DestinoUsuarioId);

    if (origem == null) return Results.NotFound("Usuário de origem não encontrado.");
    if (destino == null) return Results.NotFound("Usuário de destino não encontrado.");
    if (pedido.Valor <= 0) return Results.BadRequest("O valor de transferencia inválido.");

    if (origem.Saldo < pedido.Valor)
    {
        return Results.BadRequest("Saldo insuficiente");
    }

    origem.Saldo -= pedido.Valor;
    destino.Saldo += pedido.Valor;

    var novaTransferencia = new Transferencia
     {
        Origem = origem.Nome,
        Destino = destino.Nome,
        Valor = pedido.Valor
    };
    db.Transferencias.Add(novaTransferencia);
    await db.SaveChangesAsync();

    return Results.Ok(new { mensagem = $"Transferencia de R${pedido.Valor} tranferido para {destino.Nome}!", seuSaldo = origem.Saldo });

});

//Histórico
app.MapGet("/carteira/transferencias", async (AppDbContext db) =>
    Results.Ok(await db.Transferencias.ToListAsync()));

app.UseStaticFiles();
app.Run();

//Classes
public class Usuario
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public double Saldo { get; set; }
}

public class OperacaoFinanceira
{
    public int UsuarioId { get; set; }
    public double Valor { get; set; }
}

public class PedidoTransferencia
{
    public int OrigemUsuarioId { get; set; }
    public int DestinoUsuarioId { get; set; }
    public double Valor { get; set; }
}

public class Transferencia
{
    public int Id { get; set; }
    public string Origem { get; set; } = string.Empty;
    public string Destino { get; set; } = string.Empty;
    public double Valor { get; set; }
}

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base (options) { }
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Transferencia> Transferencias => Set<Transferencia>();

}