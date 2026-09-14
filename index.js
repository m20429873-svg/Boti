require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const fs = require("fs");

// ======================================================
// CONFIG
// ======================================================

const TOKEN = process.env.TOKEN;
const BOT_NAME = "Boti";
const GUILD_ID = "1548054046387085424";

// Channels
const WELCOME_CHANNEL_ID = "1548406177698811924";
const BOT_LOGS_CHANNEL_ID = "1548414502805049485";
const MOD_LOGS_CHANNEL_ID = "1548414647005351976";
const STAFF_LOGS_CHANNEL_ID = "1548417311751409825";

// Roles
const OWNER_ROLE_ID = "1548393819207114964";
const COOWNER_ROLE_ID = "1548396117501411378";
const ADMIN_ROLE_ID = "1548396434121040022";
const MODERATOR_ROLE_ID = "1548396650542792745";
const EVENT_MANAGER_ROLE_ID = "1548396942827069480";

// ======================================================
// STAFF
// ======================================================

const STAFF_ROLES = [
  OWNER_ROLE_ID,
  COOWNER_ROLE_ID,
  ADMIN_ROLE_ID,
  MODERATOR_ROLE_ID,
  EVENT_MANAGER_ROLE_ID
];

const WARN_ROLES = [
  OWNER_ROLE_ID,
  COOWNER_ROLE_ID,
  ADMIN_ROLE_ID
];

// ======================================================
// POINTS
// ======================================================

const SALARIES = {
  [OWNER_ROLE_ID]: 100,
  [COOWNER_ROLE_ID]: 90,
  [ADMIN_ROLE_ID]: 80,
  [MODERATOR_ROLE_ID]: 50,
  [EVENT_MANAGER_ROLE_ID]: 20
};

const PROMOTIONS = {
  [EVENT_MANAGER_ROLE_ID]: {
    nextRole: MODERATOR_ROLE_ID,
    required: 100,
    name: "Moderator"
  },

  [MODERATOR_ROLE_ID]: {
    nextRole: ADMIN_ROLE_ID,
    required: 200,
    name: "Admin"
  },

  [ADMIN_ROLE_ID]: {
    nextRole: COOWNER_ROLE_ID,
    required: 300,
    name: "Co-Owner"
  },

  [COOWNER_ROLE_ID]: {
    nextRole: OWNER_ROLE_ID,
    required: 400,
    name: "Owner"
  }
};

// ======================================================
// DATABASE
// ======================================================

const DB_FILE = "./database.json";

let db = {
  users: {},
  tickets: {},
  bans: {}
};

if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(
      fs.readFileSync(DB_FILE, "utf8")
    );

    if (!db.users) db.users = {};
    if (!db.tickets) db.tickets = {};
    if (!db.bans) db.bans = {};

  } catch (error) {

    console.log(
      "Database error, creating new database."
    );

    db = {
      users: {},
      tickets: {},
      bans: {}
    };
  }
}

// ======================================================
// SAVE DATABASE
// ======================================================

function saveDB() {
  try {

    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(db, null, 2)
    );

  } catch (error) {

    console.log(
      "Database save error:",
      error.message
    );
  }
}

// ======================================================
// CLIENT
// ======================================================

const client = new Client({

  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],

  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.GuildMember
  ]
});

// ======================================================
// HELPERS
// ======================================================

function getUserData(userId) {

  if (!db.users[userId]) {

    db.users[userId] = {
      points: 0,
      salaryLastClaim: 0,
      warnings: 0,
      firstTicketClaim: false
    };

    saveDB();
  }

  return db.users[userId];
}

function hasStaffRole(member) {

  if (!member?.roles?.cache) {
    return false;
  }

  return STAFF_ROLES.some(
    roleId => member.roles.cache.has(roleId)
  );
}

function canWarn(member) {

  if (!member?.roles?.cache) {
    return false;
  }

  return WARN_ROLES.some(
    roleId => member.roles.cache.has(roleId)
  );
}

function isOwner(member) {

  return member?.roles?.cache?.has(
    OWNER_ROLE_ID
  );
}

function getStaffRole(member) {

  if (!member?.roles?.cache) {
    return null;
  }

  for (const roleId of [
    OWNER_ROLE_ID,
    COOWNER_ROLE_ID,
    ADMIN_ROLE_ID,
    MODERATOR_ROLE_ID,
    EVENT_MANAGER_ROLE_ID
  ]) {

    if (member.roles.cache.has(roleId)) {
      return roleId;
    }
  }

  return null;
}

async function getChannel(guild, channelId) {

  try {
    return await guild.channels.fetch(channelId);
  } catch {
    return null;
  }
}

// ======================================================
// LOGS
// ======================================================

async function sendLog(guild, channelId, embed) {

  try {

    const channel =
      await getChannel(guild, channelId);

    if (
      channel &&
      channel.isTextBased()
    ) {

      await channel.send({
        embeds: [embed]
      });
    }

  } catch (error) {

    console.log(
      "Log error:",
      error.message
    );
  }
}

async function botLog(
  guild,
  title,
  description
) {

  const embed =
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setAuthor({
        name: BOT_NAME
      })
      .setTitle(title)
      .setDescription(description)
      .setFooter({
        text: `${BOT_NAME} • Bot Logs`
      })
      .setTimestamp();

  await sendLog(
    guild,
    BOT_LOGS_CHANNEL_ID,
    embed
  );
}

async function modLog(
  guild,
  title,
  description
) {

  const embed =
    new EmbedBuilder()
      .setColor(0xff4d6d)
      .setAuthor({
        name: BOT_NAME
      })
      .setTitle(title)
      .setDescription(description)
      .setFooter({
        text: `${BOT_NAME} • Moderation`
      })
      .setTimestamp();

  await sendLog(
    guild,
    MOD_LOGS_CHANNEL_ID,
    embed
  );
}

async function staffLog(
  guild,
  title,
  description
) {

  const embed =
    new EmbedBuilder()
      .setColor(0x7c3aed)
      .setAuthor({
        name: BOT_NAME
      })
      .setTitle(title)
      .setDescription(description)
      .setFooter({
        text: `${BOT_NAME} • Staff`
      })
      .setTimestamp();

  await sendLog(
    guild,
    STAFF_LOGS_CHANNEL_ID,
    embed
  );
}

// ======================================================
// PROMOTION
// ======================================================

async function checkPromotion(member) {

  const roleId = getStaffRole(member);

  if (!roleId) return;

  const promotion = PROMOTIONS[roleId];

  if (!promotion) return;

  const data = getUserData(member.id);

  if (data.points < promotion.required) {
    return;
  }

  try {

    await member.roles.remove(roleId);

    await member.roles.add(
      promotion.nextRole
    );

    const oldPoints = data.points;

    data.points = 0;

    saveDB();

    const embed =
      new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setAuthor({
          name: BOT_NAME
        })
        .setTitle("🎉 ترقية إدارية")
        .setDescription(
          `💜 تم ترقية <@${member.id}>\n\n` +
          `✨ من: <@&${roleId}>\n` +
          `🆙 إلى: <@&${promotion.nextRole}>\n` +
          `🏆 النقاط المطلوبة: **${promotion.required}**\n` +
          `💠 النقاط قبل الترقية: **${oldPoints}**\n` +
          `🔄 تم تصفير النقاط إلى **0**`
        )
        .setFooter({
          text: `${BOT_NAME} • Promotions`
        })
        .setTimestamp();

    await sendLog(
      member.guild,
      STAFF_LOGS_CHANNEL_ID,
      embed
    );

    try {

      await member.send(
        `🎉 مبروك!\n\n` +
        `تمت ترقيتك إلى **${promotion.name}** 💜\n` +
        `وكان لديك **${oldPoints}** نقطة.\n` +
        `تم تصفير نقاطك وبدأت مرحلة جديدة.\n\n` +
        `🤖 ${BOT_NAME}`
      );

    } catch {}

  } catch (error) {

    console.log(
      "Promotion error:",
      error.message
    );
  }
}

// ======================================================
// SLASH COMMANDS
// ======================================================

const commands = [

  // /ip
  new SlashCommandBuilder()
    .setName("ip")
    .setDescription("عرض IP سيرفر ماينكرافت"),

  // /top
  new SlashCommandBuilder()
    .setName("top")
    .setDescription("عرض أفضل 10 إداريين بالنقاط"),

  // /role
  new SlashCommandBuilder()
    .setName("role")
    .setDescription("استلام راتب الإدارة كل 24 ساعة"),

  // /add
  new SlashCommandBuilder()
    .setName("add")
    .setDescription("إضافة نقاط لعضو - Owner فقط")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("points")
        .setDescription("عدد النقاط")
        .setRequired(true)
        .setMinValue(1)
    ),

  // /minus
  new SlashCommandBuilder()
    .setName("minus")
    .setDescription("خصم نقاط من عضو - Owner فقط")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("points")
        .setDescription("عدد النقاط")
        .setRequired(true)
        .setMinValue(1)
    ),

  // /clear
  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("حذف رسائل - Owner فقط")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("عدد الرسائل")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  // /staff-request
  new SlashCommandBuilder()
    .setName("staff-request")
    .setDescription("طلب مساعدة من الإدارة"),

  // /setup-ticket
  new SlashCommandBuilder()
    .setName("setup-ticket")
    .setDescription("إنشاء لوحة التذاكر"),

  // /ticket-setup
  new SlashCommandBuilder()
    .setName("ticket-setup")
    .setDescription("إنشاء لوحة التذاكر"),

  // /warn
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("تحذير عضو")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("العضو المراد تحذيره")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("سبب التحذير")
        .setRequired(false)
    ),

  // /profile-check
  new SlashCommandBuilder()
    .setName("profile-check")
    .setDescription("فحص معلومات بروفايل عضو")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("العضو المراد فحصه")
        .setRequired(true)
    )

].map(command => command.toJSON());

// ======================================================
// REGISTER COMMANDS
// ======================================================

async function registerCommands() {

  if (!TOKEN) {
    console.log("❌ TOKEN غير موجود في .env");
    return;
  }

  if (!client.user) {
    console.log("❌ البوت لم يسجل الدخول بعد.");
    return;
  }

  try {

    const rest =
      new REST({
        version: "10"
      }).setToken(TOKEN);

    console.log(
      "🔄 جاري تسجيل أوامر البوت..."
    );

    await rest.put(
      Routes.applicationGuildCommands(
        client.user.id,
        GUILD_ID
      ),
      {
        body: commands
      }
    );

    console.log(
      `✅ تم تسجيل ${commands.length} أوامر Slash بنجاح!`
    );

    console.log(
      "📌 الأوامر: /ip /top /role /add /minus /clear /staff-request /setup-ticket /ticket-setup /warn /profile-check"
    );

  } catch (error) {

    console.log(
      "❌ Command registration error:"
    );

    console.log(error);
  }
}

// ======================================================
// READY
// ======================================================

client.once(
  "ready",
  async () => {

    console.log(
      `✅ Logged in as ${client.user.tag}`
    );

    try {

      if (
        client.user.username !== BOT_NAME
      ) {

        await client.user.setUsername(
          BOT_NAME
        );

        console.log(
          `✅ اسم البوت أصبح ${BOT_NAME}`
        );

      }

    } catch (error) {

      console.log(
        "Username change error:",
        error.message
      );
    }

    // تسجيل الأوامر
    await registerCommands();

    // الحالة
    client.user.setPresence({

      activities: [
        {
          name: "Gaming Hub",
          type: 3
        }
      ],

      status: "online"

    });

    const guild =
      client.guilds.cache.get(
        GUILD_ID
      );

    if (guild) {

      console.log(
        `✅ Connected to: ${guild.name}`
      );

      await botLog(
        guild,
        "🤖 البوت اشتغل",
        `✅ تم تشغيل **${BOT_NAME}** بنجاح.`
      );

      await checkBans();

    } else {

      console.log(
        "❌ البوت غير موجود في السيرفر المحدد."
      );
    }

    console.log(
      `🟢 ${BOT_NAME} is ONLINE`
    );
  }
);

// ======================================================
// WELCOME
// ======================================================

client.on(
  "guildMemberAdd",
  async member => {

    try {

      if (
        member.guild.id !== GUILD_ID
      ) return;

      const channel =
        await getChannel(
          member.guild,
          WELCOME_CHANNEL_ID
        );

      if (
        !channel ||
        !channel.isTextBased()
      ) return;

      const embed =
        new EmbedBuilder()
          .setColor(0x8b5cf6)
          .setAuthor({
            name: BOT_NAME
          })
          .setTitle(
            "🌸 أهلاً وسهلاً بك 💜"
          )
          .setDescription(
            `🌸・أهلاً بك <@${member.id}> 💜\n\n` +
            `🦋 نورتنا في **${member.guild.name}** 🩵\n\n` +
            `✨ أنت العضو رقم **${member.guild.memberCount}** 🎉\n\n` +
            `📜 لا تنسَ الاطلاع على القوانين\n\n` +
            `💜 نتمنى لك إقامة سعيدة معنا!`
          )
          .setFooter({
            text: `${BOT_NAME} • Welcome`
          })
          .setTimestamp();

      await channel.send({

        content:
          `<@${member.id}>`,

        embeds: [embed]

      });

    } catch (error) {

      console.log(
        "Welcome error:",
        error.message
      );
    }
  }
);

// ======================================================
// INTERACTIONS
// ======================================================

client.on(
  "interactionCreate",
  async interaction => {

    try {

      // ==================================================
      // SLASH COMMANDS
      // ==================================================

      if (
        interaction.isChatInputCommand()
      ) {

        // =================================================
        // IP
        // =================================================

        if (
          interaction.commandName === "ip"
        ) {

          return interaction.reply(
            `🎮 **Minecraft Server IP**\n\n` +
            `\`VELORA010.aternos.me:51685\`\n\n` +
            `🤖 ${BOT_NAME}`
          );
        }

        // =================================================
        // TOP
        // =================================================

        if (
          interaction.commandName === "top"
        ) {

          const members =
            Object.entries(db.users)
              .map(([userId, data]) => ({
                userId,
                points: data.points || 0
              }))
              .filter(x => x.points > 0)
              .sort((a, b) => b.points - a.points)
              .slice(0, 10);

          if (!members.length) {

            return interaction.reply({
              content:
                `💜 لا توجد نقاط مسجلة حتى الآن.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          let text = "";

          members.forEach((user, index) => {

            text +=
              `**${index + 1}.** <@${user.userId}> — 💠 **${user.points}** نقطة\n`;

          });

          const embed =
            new EmbedBuilder()
              .setColor(0x8b5cf6)
              .setAuthor({
                name: BOT_NAME
              })
              .setTitle("🏆 TOP 10")
              .setDescription(text)
              .setFooter({
                text: `${BOT_NAME} • Staff Points`
              })
              .setTimestamp();

          return interaction.reply({
            embeds: [embed]
          });
        }

        // =================================================
        // ROLE
        // =================================================

        if (
          interaction.commandName === "role"
        ) {

          const member =
            interaction.member;

          if (!hasStaffRole(member)) {

            return interaction.reply({
              content:
                `❌ هذا الأمر مخصص للإدارة فقط.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          const roleId =
            getStaffRole(member);

          const salary =
            SALARIES[roleId];

          if (!salary) {

            return interaction.reply({
              content:
                `❌ لم يتم العثور على راتب رتبتك.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          const data =
            getUserData(member.id);

          const now = Date.now();

          const DAY =
            24 * 60 * 60 * 1000;

          if (
            data.salaryLastClaim &&
            now - data.salaryLastClaim < DAY
          ) {

            const remaining =
              DAY -
              (now - data.salaryLastClaim);

            const hours =
              Math.floor(
                remaining /
                (60 * 60 * 1000)
              );

            const minutes =
              Math.floor(
                (
                  remaining %
                  (60 * 60 * 1000)
                ) /
                (60 * 1000)
              );

            return interaction.reply({
              content:
                `⏳ لقد استلمت راتبك بالفعل.\n` +
                `💰 الراتب القادم بعد **${hours} ساعة و ${minutes} دقيقة**.\n\n` +
                `🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          data.points += salary;
          data.salaryLastClaim = now;

          saveDB();

          await checkPromotion(member);

          const embed =
            new EmbedBuilder()
              .setColor(0x8b5cf6)
              .setAuthor({
                name: BOT_NAME
              })
              .setTitle(
                "💰 تم استلام الراتب"
              )
              .setDescription(
                `💜 العضو: <@${member.id}>\n` +
                `🎖️ الرتبة: <@&${roleId}>\n` +
                `💰 الراتب: **+${salary} نقطة**\n` +
                `💠 نقاطك الحالية: **${getUserData(member.id).points}**`
              )
              .setFooter({
                text: `${BOT_NAME} • Staff Salary`
              })
              .setTimestamp();

          await interaction.reply({
            embeds: [embed]
          });

          await staffLog(
            interaction.guild,
            "💰 استلام راتب",
            `<@${member.id}> استلم **+${salary}** نقطة.`
          );

          return;
        }

        // =================================================
        // ADD
        // =================================================

        if (
          interaction.commandName === "add"
        ) {

          if (!isOwner(interaction.member)) {

            return interaction.reply({
              content:
                `❌ هذا الأمر للـ 👑 Owner فقط.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          const user =
            interaction.options.getUser("user");

          const points =
            interaction.options.getInteger("points");

          const member =
            await interaction.guild.members
              .fetch(user.id)
              .catch(() => null);

          if (!member) {

            return interaction.reply({
              content:
                `❌ العضو غير موجود.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          if (!hasStaffRole(member)) {

            return interaction.reply({
              content:
                `❌ النقاط مخصصة للإدارة فقط.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          const data =
            getUserData(user.id);

          data.points += points;

          saveDB();

          await checkPromotion(member);

          return interaction.reply(
            `💠 تمت إضافة **${points}** نقطة إلى <@${user.id}>.\n` +
            `📊 النقاط الحالية: **${getUserData(user.id).points}**\n\n` +
            `🤖 ${BOT_NAME}`
          );
        }

        // =================================================
        // MINUS
        // =================================================

        if (
          interaction.commandName === "minus"
        ) {

          if (!isOwner(interaction.member)) {

            return interaction.reply({
              content:
                `❌ هذا الأمر للـ 👑 Owner فقط.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          const user =
            interaction.options.getUser("user");

          const points =
            interaction.options.getInteger("points");

          const data =
            getUserData(user.id);

          data.points =
            Math.max(
              0,
              data.points - points
            );

          saveDB();

          return interaction.reply(
            `➖ تم خصم **${points}** نقطة من <@${user.id}>.\n` +
            `💠 النقاط الحالية: **${data.points}**\n\n` +
            `🤖 ${BOT_NAME}`
          );
        }

        // =================================================
        // CLEAR
        // =================================================

        if (
          interaction.commandName === "clear"
        ) {

          if (!isOwner(interaction.member)) {

            return interaction.reply({
              content:
                `❌ هذا الأمر للـ 👑 Owner فقط.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          const amount =
            interaction.options.getInteger("amount");

          if (
            !interaction.channel ||
            !interaction.channel.isTextBased()
          ) {

            return interaction.reply({
              content:
                `❌ لا يمكن استخدام الأمر هنا.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          await interaction.channel.bulkDelete(
            amount,
            true
          );

          return interaction.reply({
            content:
              `🧹 تم حذف **${amount}** رسالة.\n\n🤖 ${BOT_NAME}`,
            ephemeral: true
          });
        }

        // =================================================
        // STAFF REQUEST
        // =================================================

        if (
          interaction.commandName === "staff-request"
        ) {

          return interaction.reply(
            `🎯 <@&${EVENT_MANAGER_ROLE_ID}>\n` +
            `رجاءً التوصل معها بأسرع وقت 💜\n\n` +
            `🤖 ${BOT_NAME}`
          );
        }

        // =================================================
        // TICKET SETUP
        // =================================================

        if (
          interaction.commandName === "setup-ticket" ||
          interaction.commandName === "ticket-setup"
        ) {

          if (!isOwner(interaction.member)) {

            return interaction.reply({
              content:
                `❌ هذا الأمر للـ 👑 Owner فقط.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          const embed =
            new EmbedBuilder()
              .setColor(0x8b5cf6)
              .setAuthor({
                name: BOT_NAME
              })
              .setTitle(
                "🎫 نظام التذاكر"
              )
              .setDescription(
                `💜 محتاج مساعدة؟ افتح تذكرة من الزر بالأسفل.\n\n` +
                `📝 اشرح مشكلتك بالتفصيل.\n` +
                `🎯 سيتم إشعار Event Manager.\n\n` +
                `⚠️ يمنع فتح تذاكر بدون سبب.`
              )
              .setFooter({
                text: `${BOT_NAME} • Tickets`
              });

          const row =
            new ActionRowBuilder()
              .addComponents(

                new ButtonBuilder()
                  .setCustomId(
                    "create_ticket"
                  )
                  .setLabel(
                    "فتح تذكرة"
                  )
                  .setEmoji("🎫")
                  .setStyle(
                    ButtonStyle.Primary
                  )

              );

          await interaction.channel.send({

            embeds: [embed],

            components: [row]

          });

          return interaction.reply({
            content:
              `✅ تم إنشاء لوحة التذاكر.\n\n🤖 ${BOT_NAME}`,
            ephemeral: true
          });
        }

        // =================================================
        // WARN
        // =================================================

        if (
          interaction.commandName === "warn"
        ) {

          if (!canWarn(interaction.member)) {

            return interaction.reply({
              content:
                `❌ أمر Warn مسموح فقط لـ Owner / Co-Owner / Admin.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          const user =
            interaction.options.getUser("user");

          const reason =
            interaction.options.getString("reason") ||
            "لم يتم تحديد سبب";

          const member =
            await interaction.guild.members
              .fetch(user.id)
              .catch(() => null);

          if (!member) {

            return interaction.reply({
              content:
                `❌ العضو غير موجود.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          if (
            member.id ===
            interaction.user.id
          ) {

            return interaction.reply({
              content:
                `❌ لا يمكنك تحذير نفسك.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          const executorHighest =
            interaction.member.roles.highest.position;

          const targetHighest =
            member.roles.highest.position;

          if (
            targetHighest >= executorHighest &&
            member.id !== interaction.guild.ownerId
          ) {

            return interaction.reply({
              content:
                `❌ لا يمكنك تحذير شخص رتبته مساوية أو أعلى من رتبتك.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          const data =
            getUserData(user.id);

          data.warnings += 1;

          const warnNumber =
            data.warnings;

          saveDB();

          let punishment = "";

          if (warnNumber === 1) {

            punishment =
              "⚠️ تحذير أول";

          } else if (warnNumber === 2) {

            punishment =
              "⚠️ تحذير ثاني";

          } else if (warnNumber === 3) {

            try {

              await member.timeout(
                3 * 60 * 60 * 1000,
                `Warn 3: ${reason}`
              );

              punishment =
                "🔇 Mute لمدة 3 ساعات";

            } catch {

              punishment =
                "🔇 Mute لمدة 3 ساعات - فشل التطبيق";
            }

          } else if (warnNumber === 4) {

            try {

              await member.kick(
                `Warn 4: ${reason}`
              );

              punishment =
                "👢 Kick";

            } catch {

              punishment =
                "👢 Kick - فشل التطبيق";
            }

          } else if (warnNumber === 5) {

            try {

              await member.ban({

                deleteMessageSeconds: 0,

                reason:
                  `Warn 5: ${reason}`

              });

              const unbanAt =
                Date.now() +
                24 * 60 * 60 * 1000;

              db.bans[user.id] = {

                guildId:
                  interaction.guild.id,

                unbanAt

              };

              saveDB();

              punishment =
                "🔨 Ban لمدة 24 ساعة";

              setTimeout(
                async () => {

                  try {

                    const guild =
                      client.guilds.cache.get(
                        GUILD_ID
                      );

                    if (guild) {

                      await guild.members.unban(
                        user.id,
                        "انتهاء مدة البان - 24 ساعة"
                      );
                    }

                    delete db.bans[user.id];

                    saveDB();

                  } catch {}

                },
                24 * 60 * 60 * 1000
              );

            } catch {

              punishment =
                "🔨 Ban لمدة 24 ساعة - فشل التطبيق";
            }

          } else {

            data.warnings = 5;

            saveDB();

            return interaction.reply({
              content:
                `❌ <@${user.id}> وصل بالفعل إلى Warn 5.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          const embed =
            new EmbedBuilder()
              .setColor(0xff4d6d)
              .setAuthor({
                name: BOT_NAME
              })
              .setTitle(
                `⚠️ Warn ${warnNumber}`
              )
              .setDescription(
                `👤 العضو: <@${user.id}>\n` +
                `🛡️ بواسطة: <@${interaction.user.id}>\n\n` +
                `📌 السبب:\n${reason}\n\n` +
                `⚖️ العقوبة:\n**${punishment}**\n\n` +
                `📊 التحذيرات: **${warnNumber}/5**`
              )
              .setFooter({
                text: `${BOT_NAME} • Warnings`
              })
              .setTimestamp();

          await interaction.reply({
            embeds: [embed]
          });

          await modLog(
            interaction.guild,
            `⚠️ Warn ${warnNumber}`,
            `👤 العضو: <@${user.id}>\n` +
            `🛡️ بواسطة: <@${interaction.user.id}>\n` +
            `📌 السبب: ${reason}\n` +
            `⚖️ العقوبة: ${punishment}`
          );

          try {
            await user.send({
              embeds: [embed]
            });
          } catch {}

          return;
        }

        // =================================================
        // PROFILE CHECK
        // =================================================

        if (
          interaction.commandName === "profile-check"
        ) {

          if (!hasStaffRole(interaction.member)) {

            return interaction.reply({
              content:
                `❌ هذا الأمر مخصص للإدارة فقط.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          const user =
            interaction.options.getUser("user");

          const member =
            await interaction.guild.members
              .fetch(user.id)
              .catch(() => null);

          if (!member) {

            return interaction.reply({
              content:
                `❌ العضو غير موجود.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          let staffStatus =
            "👤 عضو عادي";

          if (
            member.id ===
            interaction.guild.ownerId
          ) {
            staffStatus = "👑 Server Owner";

          } else if (
            member.roles.cache.has(
              OWNER_ROLE_ID
            )
          ) {
            staffStatus = "👑 Owner";

          } else if (
            member.roles.cache.has(
              COOWNER_ROLE_ID
            )
          ) {
            staffStatus = "💜 Co-Owner";

          } else if (
            member.roles.cache.has(
              ADMIN_ROLE_ID
            )
          ) {
            staffStatus = "🛡️ Admin";

          } else if (
            member.roles.cache.has(
              MODERATOR_ROLE_ID
            )
          ) {
            staffStatus = "🔨 Moderator";

          } else if (
            member.roles.cache.has(
              EVENT_MANAGER_ROLE_ID
            )
          ) {
            staffStatus = "🎯 Event Manager";
          }

          const roles =
            member.roles.cache
              .filter(
                role =>
                  role.id !==
                  interaction.guild.id
              )
              .sort(
                (a, b) =>
                  b.position - a.position
              );

          const rolesText =
            roles.size > 0
              ? roles
                  .map(
                    role =>
                      `<@&${role.id}>`
                  )
                  .join(" ")
              : "لا توجد رتب";

          const createdAt =
            Math.floor(
              user.createdTimestamp / 1000
            );

          const joinedAt =
            member.joinedTimestamp
              ? Math.floor(
                  member.joinedTimestamp / 1000
                )
              : null;

          const avatar =
            user.displayAvatarURL({
              size: 1024,
              extension: "png",
              forceStatic: false
            });

          let banner = null;

          try {

            const fullUser =
              await user.fetch();

            banner =
              fullUser.bannerURL({
                size: 1024,
                extension: "png",
                forceStatic: false
              });

          } catch {}

          const embed =
            new EmbedBuilder()
              .setColor(0x8b5cf6)
              .setAuthor({
                name: BOT_NAME
              })
              .setTitle(
                "🔎 فحص البروفايل"
              )
              .setThumbnail(avatar)
              .setDescription(
                `👤 **العضو:** <@${user.id}>\n` +
                `🏷️ **Username:** \`${user.username}\`\n` +
                `✨ **Display Name:** ${user.displayName}\n` +
                `🆔 **ID:** \`${user.id}\`\n\n` +
                `🛡️ **الحالة الإدارية:**\n${staffStatus}\n\n` +
                `📅 **إنشاء الحساب:**\n` +
                `<t:${createdAt}:F>\n` +
                `<t:${createdAt}:R>\n\n` +
                `📥 **دخول السيرفر:**\n` +
                (
                  joinedAt
                    ? `<t:${joinedAt}:F>\n<t:${joinedAt}:R>`
                    : "غير معروف"
                )
              )
              .addFields({
                name: "🎖️ الرتب",
                value:
                  rolesText.length > 1024
                    ? rolesText.slice(0, 1020) + "..."
                    : rolesText
              })
              .setFooter({
                text:
                  `${BOT_NAME} • Profile Check`
              })
              .setTimestamp();

          if (banner) {
            embed.setImage(banner);
          }

          return interaction.reply({
            embeds: [embed]
          });
        }
      }

      // ==================================================
      // BUTTONS
      // ==================================================

      if (interaction.isButton()) {

        // ==================================================
        // CREATE TICKET
        // ==================================================

        if (
          interaction.customId === "create_ticket"
        ) {

          const guild =
            interaction.guild;

          const user =
            interaction.user;

          const existingTicket =
            Object.values(db.tickets).find(
              ticket =>
                ticket.guildId === guild.id &&
                ticket.userId === user.id &&
                ticket.closed === false
            );

          if (existingTicket) {

            const oldChannel =
              guild.channels.cache.get(
                existingTicket.channelId
              );

            if (oldChannel) {

              return interaction.reply({
                content:
                  `❌ لديك تذكرة مفتوحة بالفعل:\n` +
                  `<#${oldChannel.id}>\n\n` +
                  `🤖 ${BOT_NAME}`,
                ephemeral: true
              });
            }
          }

          const parent =
            interaction.channel.parent;

          const ticketNumber =
            Date.now()
              .toString()
              .slice(-6);

          const channel =
            await guild.channels.create({

              name:
                `ticket-${ticketNumber}`,

              type:
                ChannelType.GuildText,

              parent:
                parent?.id || null,

              permissionOverwrites: [

                {
                  id:
                    guild.roles.everyone.id,

                  deny: [
                    PermissionsBitField.Flags
                      .ViewChannel
                  ]
                },

                {
                  id:
                    user.id,

                  allow: [
                    PermissionsBitField.Flags
                      .ViewChannel,

                    PermissionsBitField.Flags
                      .SendMessages,

                    PermissionsBitField.Flags
                      .ReadMessageHistory
                  ]
                },

                ...STAFF_ROLES.map(
                  roleId => ({

                    id:
                      roleId,

                    allow: [
                      PermissionsBitField.Flags
                        .ViewChannel,

                      PermissionsBitField.Flags
                        .SendMessages,

                      PermissionsBitField.Flags
                        .ReadMessageHistory
                    ]
                  })
                )

              ]
            });

          db.tickets[channel.id] = {

            guildId:
              guild.id,

            userId:
              user.id,

            channelId:
              channel.id,

            claimedBy:
              null,

            closed:
              false,

            createdAt:
              Date.now()
          };

          saveDB();

          const embed =
            new EmbedBuilder()
              .setColor(0x8b5cf6)
              .setAuthor({
                name: BOT_NAME
              })
              .setTitle(
                "🎫 تذكرة جديدة"
              )
              .setDescription(
                `🌸 أهلاً <@${user.id}>\n\n` +
                `🎯 <@&${EVENT_MANAGER_ROLE_ID}>\n` +
                `**رجاء التوصل معها بأسرع وقت.**\n\n` +
                `💜 اشرح مشكلتك بالتفصيل وانتظر الإدارة.`
              )
              .setFooter({
                text:
                  `${BOT_NAME} • Tickets`
              })
              .setTimestamp();

          const row =
            new ActionRowBuilder()
              .addComponents(

                new ButtonBuilder()
                  .setCustomId(
                    "claim_ticket"
                  )
                  .setLabel(
                    "استلم التذكرة"
                  )
                  .setEmoji("📥")
                  .setStyle(
                    ButtonStyle.Success
                  ),

                new ButtonBuilder()
                  .setCustomId(
                    "close_ticket"
                  )
                  .setLabel(
                    "قفل التذكرة"
                  )
                  .setEmoji("🔒")
                  .setStyle(
                    ButtonStyle.Danger
                  )

              );

          await channel.send({

            content:
              `<@${user.id}> <@&${EVENT_MANAGER_ROLE_ID}>`,

            embeds: [embed],

            components: [row]
          });

          await interaction.reply({

            content:
              `✅ تم فتح تذكرتك:\n` +
              `<#${channel.id}>\n\n` +
              `🤖 ${BOT_NAME}`,

            ephemeral: true
          });

          await botLog(
            guild,
            "🎫 Ticket Created",
            `<@${user.id}> قام بفتح تذكرة.\n` +
            `📁 <#${channel.id}>`
          );

          return;
        }

        // ==================================================
        // CLAIM TICKET
        // ==================================================

        if (
          interaction.customId === "claim_ticket"
        ) {

          const member =
            interaction.member;

          if (!hasStaffRole(member)) {

            return interaction.reply({
              content:
                `❌ هذا الزر مخصص للإدارة فقط.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          const ticket =
            db.tickets[
              interaction.channel.id
            ];

          if (
            !ticket ||
            ticket.closed
          ) {

            return interaction.reply({
              content:
                `❌ هذه التذكرة غير موجودة.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          if (ticket.claimedBy) {

            return interaction.reply({
              content:
                `❌ التذكرة مستلمة بالفعل بواسطة <@${ticket.claimedBy}>.\n\n` +
                `🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          const data =
            getUserData(member.id);

          if (!data.firstTicketClaim) {

            data.points += 10;

            data.firstTicketClaim = true;

            await interaction.channel.send(
              `📥 <@${member.id}> استلم التذكرة.\n` +
              `💠 حصل على **+10 نقاط** لأول استلام.\n\n` +
              `🤖 ${BOT_NAME}`
            );

          } else {

            data.points =
              Math.max(
                0,
                data.points - 20
              );

            await interaction.channel.send(
              `📥 <@${member.id}> استلم التذكرة.\n` +
              `➖ تم خصم **20 نقطة** لأن هذا ليس أول استلام له.\n\n` +
              `🤖 ${BOT_NAME}`
            );
          }

          ticket.claimedBy =
            member.id;

          saveDB();

          await checkPromotion(member);

          return interaction.reply(
            `✅ تم استلام التذكرة بنجاح.\n` +
            `💠 نقاطك الحالية: **${getUserData(member.id).points}**\n\n` +
            `🤖 ${BOT_NAME}`
          );
        }

        // ==================================================
        // CLOSE TICKET
        // ==================================================

        if (
          interaction.customId === "close_ticket"
        ) {

          const member =
            interaction.member;

          if (!hasStaffRole(member)) {

            return interaction.reply({
              content:
                `❌ لا يمكنك قفل التذكرة.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          const ticket =
            db.tickets[
              interaction.channel.id
            ];

          if (!ticket) {

            return interaction.reply({
              content:
                `❌ هذه ليست تذكرة مسجلة.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          if (ticket.closed) {

            return interaction.reply({
              content:
                `❌ التذكرة مقفولة بالفعل.\n\n🤖 ${BOT_NAME}`,
              ephemeral: true
            });
          }

          ticket.closed = true;

          saveDB();

          await interaction.reply(
            `🔒 تم قفل التذكرة بواسطة <@${member.id}>.\n` +
            `🗑️ سيتم حذفها بعد **5 ثواني**.\n\n` +
            `🤖 ${BOT_NAME}`
          );

          await botLog(
            interaction.guild,
            "🔒 Ticket Closed",
            `<@${member.id}> قام بقفل التذكرة.\n` +
            `📁 ${interaction.channel.name}`
          );

          setTimeout(
            async () => {

              try {

                await interaction.channel.delete(
                  "Ticket closed"
                );

              } catch {}

            },
            5000
          );

          return;
        }
      }

    } catch (error) {

      console.log(
        "INTERACTION ERROR:",
        error
      );

      try {

        if (
          !interaction.replied &&
          !interaction.deferred
        ) {

          await interaction.reply({
            content:
              `❌ حدث خطأ أثناء تنفيذ الأمر.\n\n🤖 ${BOT_NAME}`,
            ephemeral: true
          });
        }

      } catch {}
    }
  }
);

// ======================================================
// NORMAL MESSAGE IP COMMAND
// ======================================================

client.on(
  "messageCreate",
  async message => {

    try {

      if (message.author.bot) return;

      if (
        !message.guild ||
        message.guild.id !== GUILD_ID
      ) {
        return;
      }

      if (
        message.content
          .trim()
          .toLowerCase() === "ip"
      ) {

        await message.reply(
          `🎮 **Minecraft Server IP**\n\n` +
          `\`VELORA010.aternos.me:51685\`\n\n` +
          `🤖 ${BOT_NAME}`
        );
      }

    } catch (error) {

      console.log(
        "IP MESSAGE ERROR:",
        error.message
      );
    }
  }
);

// ======================================================
// AUTO UNBAN
// ======================================================

async function checkBans() {

  const guild =
    client.guilds.cache.get(
      GUILD_ID
    );

  if (!guild) return;

  const now =
    Date.now();

  for (
    const [userId, banData]
    of Object.entries(db.bans)
  ) {

    if (now >= banData.unbanAt) {

      try {

        await guild.members.unban(
          userId,
          "انتهاء مدة البان - 24 ساعة"
        );

      } catch {}

      delete db.bans[userId];

      saveDB();
    }
  }
}

// ======================================================
// BAN CHECK
// ======================================================

setInterval(
  checkBans,
  60 * 1000
);

// ======================================================
// ERROR HANDLING
// ======================================================

process.on(
  "unhandledRejection",
  error => {

    console.log(
      "Unhandled Rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  error => {

    console.log(
      "Uncaught Exception:",
      error
    );
  }
);

// ======================================================
// LOGIN
// ======================================================

if (!TOKEN) {

  console.log(
    "❌ TOKEN غير موجود!"
  );

  console.log(
    "ضع التوكن داخل .env هكذا:"
  );

  console.log(
    "TOKEN=YOUR_BOT_TOKEN"
  );

} else {

  client.login(TOKEN)
    .then(() => {

      console.log(
        "🔐 Login request sent successfully."
      );

    })
    .catch(error => {

      console.log(
        "❌ Discord Login Error:"
      );

      console.log(
        error.message
      );
    });
}
