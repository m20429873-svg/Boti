require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
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
// الإعدادات
// ======================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const SERVER_NAME = "CoperCrfte.Mc";

// غيّر IP السيرفر هنا
const SERVER_IP = "play.example.com";

// ======================================================
// رتب الإدارة
// ======================================================

const STAFF_ROLES = [
  "Trial",
  "Helper",
  "Sr Helper",
  "Mod",
  "Sr Mod",
  "Jr Admin",
  "Admin",
  "Co Owner",
  "Hp Owner",
  "Owner"
];

// من Sr Mod وما فوق
const SENIOR_STAFF_ROLES = [
  "Sr Mod",
  "Jr Admin",
  "Admin",
  "Co Owner",
  "Hp Owner",
  "Owner"
];

// ======================================================
// نقاط الترقية
// ======================================================

const RANK_POINTS = {
  "Trial": 0,
  "Helper": 50,
  "Sr Helper": 120,
  "Mod": 250,
  "Sr Mod": 400,
  "Jr Admin": 600,
  "Admin": 850,
  "Co Owner": 1200,
  "Hp Owner": 1700,
  "Owner": 2500
};

// ======================================================
// البيانات
// ======================================================

const DATA_FILE = "./points.json";

let data = {
  points: {},
  salary: {},
  tickets: {}
};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );
  } catch {
    console.log("تعذر قراءة points.json");
  }
}

function saveData() {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2)
  );
}

// ======================================================
// البوت
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ======================================================
// الرتب
// ======================================================

function isStaff(member) {
  return STAFF_ROLES.some(name =>
    member.roles.cache.some(
      role =>
        role.name.toLowerCase() === name.toLowerCase()
    )
  );
}

function isSeniorStaff(member) {
  return SENIOR_STAFF_ROLES.some(name =>
    member.roles.cache.some(
      role =>
        role.name.toLowerCase() === name.toLowerCase()
    )
  );
}

// ======================================================
// النقاط
// ======================================================

function getPoints(userId) {
  return Number(data.points[userId] || 0);
}

function setPoints(userId, points) {
  data.points[userId] = Math.max(0, points);
  saveData();
}

function addPoints(userId, amount) {
  const newPoints =
    getPoints(userId) + amount;

  setPoints(userId, newPoints);

  return Math.max(0, newPoints);
}

// ======================================================
// الرتبة المستحقة
// ======================================================

function getRankByPoints(points) {

  let rank = "Trial";

  for (const role of STAFF_ROLES) {

    if (points >= RANK_POINTS[role]) {
      rank = role;
    }

  }

  return rank;
}

// ======================================================
// تحديث رتبة الإدارة
// ======================================================

async function updateStaffRank(member) {

  const points = getPoints(member.id);

  const wantedRank =
    getRankByPoints(points);

  const wantedRole =
    member.guild.roles.cache.find(
      role =>
        role.name.toLowerCase() ===
        wantedRank.toLowerCase()
    );

  if (!wantedRole) return;

  for (const roleName of STAFF_ROLES) {

    const role =
      member.guild.roles.cache.find(
        r =>
          r.name.toLowerCase() ===
          roleName.toLowerCase()
      );

    if (
      role &&
      role.id !== wantedRole.id &&
      member.roles.cache.has(role.id)
    ) {

      await member.roles
        .remove(role)
        .catch(() => {});

    }
  }

  if (!member.roles.cache.has(wantedRole.id)) {

    await member.roles
      .add(wantedRole)
      .catch(() => {});

  }
}

// ======================================================
// أوامر Slash
// ======================================================

const commands = [

  new SlashCommandBuilder()
    .setName("ip")
    .setDescription("عرض IP السيرفر"),

  new SlashCommandBuilder()
    .setName("نقاطي")
    .setDescription("عرض نقاط الإدارة"),

  new SlashCommandBuilder()
    .setName("راتبي")
    .setDescription("استلام راتب الإدارة"),

  new SlashCommandBuilder()
    .setName("claim")
    .setDescription("استلام التكت"),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("تحذير عضو")
    .addUserOption(option =>
      option
        .setName("العضو")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("السبب")
        .setDescription("سبب التحذير")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("طلب_استاف")
    .setDescription("طلب حضور الإدارة"),

  new SlashCommandBuilder()
    .setName("setup-ticket")
    .setDescription("إنشاء لوحة التكت")

].map(command => command.toJSON());

// ======================================================
// تسجيل الأوامر Global
// لا يوجد GUILD_ID
// ======================================================

async function registerCommands() {

  try {

    const rest =
      new REST({ version: "10" })
        .setToken(TOKEN);

    console.log(
      "جاري تسجيل الأوامر Global..."
    );

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      {
        body: commands
      }
    );

    console.log(
      "تم تسجيل الأوامر بنجاح."
    );

  } catch (error) {

    console.error(
      "خطأ في تسجيل الأوامر:",
      error
    );

  }
}

// ======================================================
// Ready
// ======================================================

client.once("ready", async () => {

  console.log(
    "================================"
  );

  console.log(
    `تم تشغيل البوت: ${client.user.tag}`
  );

  console.log(
    `السيرفر: ${SERVER_NAME}`
  );

  console.log(
    "================================"
  );

  await registerCommands();

  client.user.setPresence({

    activities: [
      {
        name: `${SERVER_NAME} | /ip`,
        type: 0
      }
    ],

    status: "online"

  });

});

// ======================================================
// التفاعلات
// ======================================================

client.on(
  "interactionCreate",
  async interaction => {

    // ==================================================
    // الأزرار
    // ==================================================

    if (interaction.isButton()) {

      // ================================================
      // فتح التكت
      // ================================================

      if (
        interaction.customId ===
        "open_ticket"
      ) {

        const guild =
          interaction.guild;

        const member =
          interaction.member;

        const existing =
          guild.channels.cache.find(
            channel =>
              channel.type ===
                ChannelType.GuildText &&
              channel.topic ===
                `ticket-owner:${member.id}`
          );

        if (existing) {

          return interaction.reply({

            content:
              `❌ لديك تكت مفتوحة بالفعل: ${existing}`,

            ephemeral: true

          });

        }

        const safeName =
          member.user.username
            .toLowerCase()
            .replace(
              /[^a-z0-9-_]/g,
              ""
            )
            .slice(0, 20) ||
          "user";

        const channel =
          await guild.channels.create({

            name:
              `ticket-${safeName}`,

            type:
              ChannelType.GuildText,

            topic:
              `ticket-owner:${member.id}`,

            permissionOverwrites: [

              {
                id: guild.id,

                deny: [
                  PermissionsBitField.Flags.ViewChannel
                ]
              },

              {
                id: member.id,

                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.ReadMessageHistory
                ]
              }

            ]

          });

        // إعطاء الإدارة صلاحية رؤية التكت

        for (
          const roleName of STAFF_ROLES
        ) {

          const role =
            guild.roles.cache.find(
              r =>
                r.name.toLowerCase() ===
                roleName.toLowerCase()
            );

          if (role) {

            await channel.permissionOverwrites
              .create(role, {

                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true

              })
              .catch(() => {});

          }

        }

        data.tickets[channel.id] = {

          ownerId: member.id,

          claimedBy: null,

          claimCount: {}

        };

        saveData();

        // منشن الإدارة العليا

        const mentions = [];

        for (
          const roleName of
          SENIOR_STAFF_ROLES
        ) {

          const role =
            guild.roles.cache.find(
              r =>
                r.name.toLowerCase() ===
                roleName.toLowerCase()
            );

          if (role) {

            mentions.push(
              `<@&${role.id}>`
            );

          }

        }

        const embed =
          new EmbedBuilder()

            .setTitle(
              `🎫 تكت الدعم | ${SERVER_NAME}`
            )

            .setDescription(

              `مرحباً <@${member.id}> 👋\n\n` +

              `تم فتح التكت الخاصة بك.\n` +

              `**صاحب التكت:** <@${member.id}>\n\n` +

              `سيتم الرد عليك من الإدارة.`

            );

        const buttons =
          new ActionRowBuilder()
            .addComponents(

              new ButtonBuilder()

                .setCustomId(
                  "ticket_claim"
                )

                .setLabel(
                  "استلام التكت"
                )

                .setStyle(
                  ButtonStyle.Primary
                ),

              new ButtonBuilder()

                .setCustomId(
                  "ticket_close"
                )

                .setLabel(
                  "إغلاق التكت"
                )

                .setStyle(
                  ButtonStyle.Danger
                )

            );

        await interaction.reply({

          content:
            `✅ تم فتح تكتك: ${channel}`,

          ephemeral: true

        });

        await channel.send({

          content:
            `<@${member.id}>\n${mentions.join(" ")}`,

          embeds: [embed],

          components: [buttons]

        });

        return;

      }

      // ================================================
      // Claim
      // ================================================

      if (
        interaction.customId ===
        "ticket_claim"
      ) {

        const member =
          interaction.member;

        const channel =
          interaction.channel;

        if (!isStaff(member)) {

          return interaction.reply({

            content:
              "❌ هذا الزر للإدارة فقط.",

            ephemeral: true

          });

        }

        const ticket =
          data.tickets[channel.id];

        if (!ticket) {

          return interaction.reply({

            content:
              "❌ هذه القناة ليست تكت.",

            ephemeral: true

          });

        }

        // صاحب التكت ممنوع من Claim

        if (
          ticket.ownerId ===
          member.id
        ) {

          return interaction.reply({

            content:
              "❌ لا يمكنك استلام التكت التي فتحتها.",

            ephemeral: true

          });

        }

        if (
          ticket.claimedBy &&
          ticket.claimedBy !== member.id
        ) {

          return interaction.reply({

            content:
              `❌ التكت مستلمة بواسطة <@${ticket.claimedBy}>.`,

            ephemeral: true

          });

        }

        if (
          !ticket.claimCount[member.id]
        ) {

          ticket.claimCount[member.id] =
            0;

        }

        ticket.claimCount[member.id]++;

        // أول Claim

        if (
          ticket.claimCount[member.id] ===
          1
        ) {

          ticket.claimedBy =
            member.id;

          const points =
            addPoints(
              member.id,
              3
            );

          await updateStaffRank(
            member
          );

          saveData();

          return interaction.reply({

            content:
              `✅ تم استلام التكت.\n\n` +
              `⭐ **+3 نقاط**\n` +
              `📊 نقاطك: **${points}**`

          });

        }

        // Claim ثاني

        const points =
          addPoints(
            member.id,
            -50
          );

        saveData();

        return interaction.reply({

          content:
            `⚠️ تم احتساب Claim ثاني لنفس التكت.\n\n` +
            `❌ **-50 نقطة**\n` +
            `📊 نقاطك: **${points}**`

        });

      }

      // ================================================
      // إغلاق التكت
      // ================================================

      if (
        interaction.customId ===
        "ticket_close"
      ) {

        const member =
          interaction.member;

        const channel =
          interaction.channel;

        const ticket =
          data.tickets[channel.id];

        if (!ticket) {

          return interaction.reply({

            content:
              "❌ هذه ليست تكت.",

            ephemeral: true

          });

        }

        // صاحب التكت ممنوع من Close

        if (
          ticket.ownerId ===
          member.id
        ) {

          return interaction.reply({

            content:
              "❌ لا يمكنك إغلاق التكت التي فتحتها.",

            ephemeral: true

          });

        }

        if (!isStaff(member)) {

          return interaction.reply({

            content:
              "❌ الإدارة فقط تستطيع إغلاق التكت.",

            ephemeral: true

          });

        }

        await interaction.reply({

          content:
            "🔒 سيتم إغلاق التكت خلال 5 ثوانٍ..."

        });

        setTimeout(
          async () => {

            delete data.tickets[
              channel.id
            ];

            saveData();

            await channel
              .delete()
              .catch(() => {});

          },
          5000
        );

        return;

      }

    }

    // ==================================================
    // Slash Commands
    // ==================================================

    if (!interaction.isChatInputCommand())
      return;

    // ==================================================
    // /ip
    // ==================================================

    if (
      interaction.commandName ===
      "ip"
    ) {

      const embed =
        new EmbedBuilder()

          .setTitle(
            `🌐 ${SERVER_NAME}`
          )

          .setDescription(

            `**IP السيرفر:**\n` +
            `\`${SERVER_IP}\``

          );

      return interaction.reply({
        embeds: [embed]
      });

    }

    // ==================================================
    // /نقاطي
    // ==================================================

    if (
      interaction.commandName ===
      "نقاطي"
    ) {

      const points =
        getPoints(
          interaction.user.id
        );

      const rank =
        getRankByPoints(points);

      return interaction.reply({

        embeds: [

          new EmbedBuilder()

            .setTitle(
              "📊 نقاط الإدارة"
            )

            .setDescription(

              `👤 **العضو:** ${interaction.user}\n\n` +

              `⭐ **النقاط:** ${points}\n` +

              `🏆 **الرتبة المستحقة:** ${rank}`

            )

        ],

        ephemeral: true

      });

    }

    // ==================================================
    // /راتبي
    // ==================================================

    if (
      interaction.commandName ===
      "راتبي"
    ) {

      const member =
        interaction.member;

      if (
        !isSeniorStaff(member)
      ) {

        return interaction.reply({

          content:
            "❌ الراتب متاح من **Sr Mod** وما فوق.",

          ephemeral: true

        });

      }

      const now =
        Date.now();

      const last =
        Number(
          data.salary[member.id] || 0
        );

      const DAY =
        24 * 60 * 60 * 1000;

      if (
        now - last < DAY
      ) {

        const remaining =
          DAY - (now - last);

        const hours =
          Math.floor(
            remaining / 3600000
          );

        const minutes =
          Math.floor(
            (remaining % 3600000) /
              60000
          );

        return interaction.reply({

          content:
            `❌ استلمت راتبك مسبقاً.\n` +
            `⏰ المتبقي: **${hours} ساعة و ${minutes} دقيقة**`,

          ephemeral: true

        });

      }

      data.salary[member.id] =
        now;

      const points =
        addPoints(
          member.id,
          12
        );

      await updateStaffRank(
        member
      );

      saveData();

      return interaction.reply({

        embeds: [

          new EmbedBuilder()

            .setTitle(
              "💰 راتب الإدارة"
            )

            .setDescription(

              `✅ تم استلام الراتب.\n\n` +

              `⭐ **+12 نقطة**\n` +

              `📊 نقاطك الآن: **${points}**`

            )

        ]

      });

    }

    // ==================================================
    // /claim
    // ==================================================

    if (
      interaction.commandName ===
      "claim"
    ) {

      const member =
        interaction.member;

      if (!isStaff(member)) {

        return interaction.reply({

          content:
            "❌ هذا الأمر للإدارة فقط.",

          ephemeral: true

        });

      }

      const channel =
        interaction.channel;

      const ticket =
        data.tickets[channel.id];

      if (!ticket) {

        return interaction.reply({

          content:
            "❌ استخدم الأمر داخل التكت.",

          ephemeral: true

        });

      }

      if (
        ticket.ownerId ===
        member.id
      ) {

        return interaction.reply({

          content:
            "❌ لا يمكنك استلام التكت التي فتحتها.",

          ephemeral: true

        });

      }

      if (
        ticket.claimedBy &&
        ticket.claimedBy !== member.id
      ) {

        return interaction.reply({

          content:
            `❌ التكت مستلمة بواسطة <@${ticket.claimedBy}>.`,

          ephemeral: true

        });

      }

      if (
        !ticket.claimCount[member.id]
      ) {

        ticket.claimCount[member.id] =
          0;

      }

      ticket.claimCount[member.id]++;

      if (
        ticket.claimCount[member.id] ===
        1
      ) {

        ticket.claimedBy =
          member.id;

        const points =
          addPoints(
            member.id,
            3
          );

        await updateStaffRank(
          member
        );

        return interaction.reply({

          content:
            `✅ تم استلام التكت.\n` +
            `⭐ **+3 نقاط**\n` +
            `📊 نقاطك: **${points}**`

        });

      }

      const points =
        addPoints(
          member.id,
          -50
        );

      return interaction.reply({

        content:
          `⚠️ Claim ثاني في نفس التكت.\n` +
          `❌ **-50 نقطة**\n` +
          `📊 نقاطك: **${points}**`

      });

    }

    // ==================================================
    // /warn
    // ==================================================

    if (
      interaction.commandName ===
      "warn"
    ) {

      const member =
        interaction.member;

      if (
        !isSeniorStaff(member)
      ) {

        return interaction.reply({

          content:
            "❌ أمر Warn متاح من **Sr Mod** وما فوق.",

          ephemeral: true

        });

      }

      const target =
        interaction.options.getMember(
          "العضو"
        );

      const reason =
        interaction.options.getString(
          "السبب"
        );

      if (!target) {

        return interaction.reply({

          content:
            "❌ لم أجد العضو.",

          ephemeral: true

        });

      }

      const embed =
        new EmbedBuilder()

          .setTitle(
            "⚠️ تحذير"
          )

          .setDescription(

            `👤 **العضو:** ${target}\n` +

            `🛡️ **بواسطة:** ${member}\n` +

            `📝 **السبب:** ${reason}`

          )

          .setFooter({
            text: SERVER_NAME
          });

      return interaction.reply({
        embeds: [embed]
      });

    }

    // ==================================================
    // /طلب_استاف
    // ==================================================

    if (
      interaction.commandName ===
      "طلب_استاف"
    ) {

      const member =
        interaction.member;

      if (!isStaff(member)) {

        return interaction.reply({

          content:
            "❌ هذا الأمر للإدارة فقط.",

          ephemeral: true

        });

      }

      const mentions = [];

      for (
        const roleName of
        SENIOR_STAFF_ROLES
      ) {

        const role =
          interaction.guild.roles.cache.find(
            r =>
              r.name.toLowerCase() ===
              roleName.toLowerCase()
          );

        if (role) {

          mentions.push(
            `<@&${role.id}>`
          );

        }

      }

      return interaction.reply({

        content:
          `📢 **طلب استاف**\n\n` +
          `<@${member.id}> يحتاج حضور الإدارة.\n\n` +
          mentions.join(" ")

      });

    }

    // ==================================================
    // /setup-ticket
    // ==================================================

    if (
      interaction.commandName ===
      "setup-ticket"
    ) {

      if (
        !interaction.member.permissions.has(
          PermissionsBitField.Flags.Administrator
        )
      ) {

        return interaction.reply({

          content:
            "❌ هذا الأمر للأدمن فقط.",

          ephemeral: true

        });

      }

      const embed =
        new EmbedBuilder()

          .setTitle(
            `🎫 تذاكر الدعم | ${SERVER_NAME}`
          )

          .setDescription(

            "اضغط على الزر بالأسفل لفتح تكت.\n\n" +

            "سيتم إنشاء تكت خاصة بك وإشعار الإدارة."

          );

      const row =
        new ActionRowBuilder()
          .addComponents(

            new ButtonBuilder()

              .setCustomId(
                "open_ticket"
              )

              .setLabel(
                "فتح تكت"
              )

              .setEmoji("🎫")

              .setStyle(
                ButtonStyle.Success
              )

          );

      return interaction.reply({

        embeds: [embed],

        components: [row]

      });

    }

  }
);

// ======================================================
// التحقق من بيانات التشغيل
// ======================================================

if (!TOKEN || !CLIENT_ID) {

  console.error(
    "❌ يجب إضافة TOKEN و CLIENT_ID في Variables."
  );

  process.exit(1);

}

// ======================================================
// تسجيل الدخول
// ======================================================

client.login(TOKEN);
