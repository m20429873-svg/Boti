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
const GUILD_ID = process.env.GUILD_ID;

// اسم السيرفر
const SERVER_NAME = "CoperCrfte.Mc";

// IP السيرفر - غيّره
const SERVER_IP = "play.example.com";

// ======================================================
// رتب الإدارة من الأقل إلى الأعلى
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

// الرتب العادية
const PLAYER_ROLES = [
  "player",
  "King"
];

// ======================================================
// نقاط الترقية
// عدّل الأرقام كما تريد
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
// ملفات البيانات
// ======================================================

const DATA_FILE = "./points.json";

let data = {
  points: {},
  salary: {},
  tickets: {}
};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    console.log("تعذر قراءة points.json، سيتم إنشاء بيانات جديدة.");
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ======================================================
// إنشاء البوت
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ======================================================
// أدوات الرتب
// ======================================================

function getStaffRole(member) {
  for (let i = STAFF_ROLES.length - 1; i >= 0; i--) {
    const role = member.roles.cache.find(
      r => r.name.toLowerCase() === STAFF_ROLES[i].toLowerCase()
    );

    if (role) return role;
  }

  return null;
}

function isStaff(member) {
  return !!getStaffRole(member);
}

function isSeniorStaff(member) {
  return SENIOR_STAFF_ROLES.some(name =>
    member.roles.cache.some(
      r => r.name.toLowerCase() === name.toLowerCase()
    )
  );
}

function getStaffLevel(member) {
  for (let i = STAFF_ROLES.length - 1; i >= 0; i--) {
    if (
      member.roles.cache.some(
        r => r.name.toLowerCase() === STAFF_ROLES[i].toLowerCase()
      )
    ) {
      return i;
    }
  }

  return -1;
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
  const oldPoints = getPoints(userId);
  const newPoints = Math.max(0, oldPoints + amount);

  setPoints(userId, newPoints);

  return newPoints;
}

// ======================================================
// الرتبة المستحقة حسب النقاط
// ======================================================

function getRankByPoints(points) {
  let rank = "Trial";

  for (const roleName of STAFF_ROLES) {
    if (points >= RANK_POINTS[roleName]) {
      rank = roleName;
    }
  }

  return rank;
}

// ======================================================
// تحديث رتبة الإدارة تلقائياً
// ======================================================

async function updateStaffRank(member) {
  const points = getPoints(member.id);
  const newRank = getRankByPoints(points);

  const guild = member.guild;

  const targetRole = guild.roles.cache.find(
    r => r.name.toLowerCase() === newRank.toLowerCase()
  );

  if (!targetRole) return;

  // إزالة رتب الإدارة القديمة
  for (const roleName of STAFF_ROLES) {
    const oldRole = guild.roles.cache.find(
      r => r.name.toLowerCase() === roleName.toLowerCase()
    );

    if (oldRole && member.roles.cache.has(oldRole.id)) {
      if (oldRole.id !== targetRole.id) {
        await member.roles.remove(oldRole).catch(() => {});
      }
    }
  }

  if (!member.roles.cache.has(targetRole.id)) {
    await member.roles.add(targetRole).catch(() => {});
  }
}

// ======================================================
// أوامر البوت
// ======================================================

const commands = [

  // ------------------------------------------
  // IP
  // ------------------------------------------

  new SlashCommandBuilder()
    .setName("ip")
    .setDescription("عرض IP السيرفر"),

  // ------------------------------------------
  // نقاطي
  // ------------------------------------------

  new SlashCommandBuilder()
    .setName("نقاطي")
    .setDescription("عرض نقاطك"),

  // ------------------------------------------
  // الراتب
  // ------------------------------------------

  new SlashCommandBuilder()
    .setName("راتبي")
    .setDescription("استلام راتب الإدارة"),

  // ------------------------------------------
  // Claim
  // ------------------------------------------

  new SlashCommandBuilder()
    .setName("claim")
    .setDescription("استلام التكت"),

  // ------------------------------------------
  // Warn
  // ------------------------------------------

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("تحذير عضو")
    .addUserOption(option =>
      option
        .setName("العضو")
        .setDescription("العضو الذي تريد تحذيره")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("السبب")
        .setDescription("سبب التحذير")
        .setRequired(true)
    ),

  // ------------------------------------------
  // طلب استاف
  // ------------------------------------------

  new SlashCommandBuilder()
    .setName("طلب_استاف")
    .setDescription("طلب حضور الإدارة"),

  // ------------------------------------------
  // إنشاء لوحة التكت
  // ------------------------------------------

  new SlashCommandBuilder()
    .setName("setup-ticket")
    .setDescription("إنشاء لوحة فتح التكت")
].map(command => command.toJSON());

// ======================================================
// تسجيل الأوامر
// ======================================================

async function registerCommands() {
  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    console.log("جاري تسجيل أوامر البوت...");

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      {
        body: commands
      }
    );

    console.log("تم تسجيل جميع الأوامر بنجاح.");
  } catch (error) {
    console.error("خطأ في تسجيل الأوامر:", error);
  }
}

// ======================================================
// تشغيل البوت
// ======================================================

client.once("ready", async () => {
  console.log("================================");
  console.log(`تم تشغيل البوت: ${client.user.tag}`);
  console.log(`السيرفر: ${SERVER_NAME}`);
  console.log("================================");

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

client.on("interactionCreate", async interaction => {

  // ====================================================
  // الأزرار
  // ====================================================

  if (interaction.isButton()) {

    // ------------------------------------------
    // زر فتح التكت
    // ------------------------------------------

    if (interaction.customId === "open_ticket") {

      const guild = interaction.guild;
      const member = interaction.member;

      // البحث عن تكت موجودة لهذا العضو
      const existingTicket = guild.channels.cache.find(
        channel =>
          channel.type === ChannelType.GuildText &&
          channel.topic === `ticket-owner:${member.id}`
      );

      if (existingTicket) {
        return interaction.reply({
          content: `لديك تكت مفتوحة بالفعل: ${existingTicket}`,
          ephemeral: true
        });
      }

      // إنشاء التكت
      const channel = await guild.channels.create({
        name: `ticket-${member.user.username}`
          .toLowerCase()
          .replace(/[^a-z0-9-_]/g, "")
          .slice(0, 20),

        type: ChannelType.GuildText,

        topic: `ticket-owner:${member.id}`,

        permissionOverwrites: [
          {
            id: guild.id,
            deny: [
              PermissionsBitField.Flags.ViewChannel
            ]
          },

          // صاحب التكت
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
      for (const roleName of STAFF_ROLES) {

        const role = guild.roles.cache.find(
          r => r.name.toLowerCase() === roleName.toLowerCase()
        );

        if (role) {
          await channel.permissionOverwrites.create(role, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
          }).catch(() => {});
        }
      }

      data.tickets[channel.id] = {
        ownerId: member.id,
        claimedBy: null,
        claimCount: {}
      };

      saveData();

      const embed = new EmbedBuilder()
        .setTitle("🎫 تكت الدعم")
        .setDescription(
          `مرحباً <@${member.id}>\n\n` +
          `تم فتح التكت الخاصة بك.\n` +
          `سيتم الرد عليك من الإدارة قريباً.\n\n` +
          `**صاحب التكت:** <@${member.id}>`
        )
        .setFooter({
          text: SERVER_NAME
        });

      const buttons = new ActionRowBuilder().addComponents(

        new ButtonBuilder()
          .setCustomId("ticket_claim")
          .setLabel("استلام التكت")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("ticket_close")
          .setLabel("إغلاق التكت")
          .setStyle(ButtonStyle.Danger)
      );

      // منشن الإدارة من Sr Mod إلى Owner
      const seniorMentions = [];

      for (const roleName of SENIOR_STAFF_ROLES) {
        const role = guild.roles.cache.find(
          r => r.name.toLowerCase() === roleName.toLowerCase()
        );

        if (role) {
          seniorMentions.push(`<@&${role.id}>`);
        }
      }

      await interaction.reply({
        content: `تم فتح تكتك: ${channel}`,
        ephemeral: true
      });

      await channel.send({
        content:
          `<@${member.id}>\n\n` +
          `${seniorMentions.join(" ")}`,
        embeds: [embed],
        components: [buttons]
      });

      return;
    }

    // ------------------------------------------
    // Claim
    // ------------------------------------------

    if (interaction.customId === "ticket_claim") {

      const member = interaction.member;
      const channel = interaction.channel;

      if (!isStaff(member)) {
        return interaction.reply({
          content: "❌ هذا الزر للإدارة فقط.",
          ephemeral: true
        });
      }

      const ticket = data.tickets[channel.id];

      if (!ticket) {
        return interaction.reply({
          content: "❌ هذه القناة ليست تكت.",
          ephemeral: true
        });
      }

      // صاحب التكت لا يستطيع استلامها
      if (ticket.ownerId === member.id) {
        return interaction.reply({
          content: "❌ لا يمكنك استلام التكت التي فتحتها.",
          ephemeral: true
        });
      }

      // إذا شخص آخر مستلمها
      if (ticket.claimedBy && ticket.claimedBy !== member.id) {
        return interaction.reply({
          content: `❌ التكت مستلمة بالفعل بواسطة <@${ticket.claimedBy}>.`,
          ephemeral: true
        });
      }

      // أول Claim
      if (!ticket.claimCount[member.id]) {
        ticket.claimCount[member.id] = 0;
      }

      ticket.claimCount[member.id]++;

      if (ticket.claimCount[member.id] === 1) {

        ticket.claimedBy = member.id;

        const newPoints = addPoints(member.id, 3);

        await updateStaffRank(member);

        saveData();

        return interaction.reply({
          content:
            `✅ تم استلام التكت.\n` +
            `+3 نقاط\n` +
            `نقاطك الآن: **${newPoints}**`
        });
      }

      // Claim مرة ثانية لنفس التكت
      if (ticket.claimCount[member.id] >= 2) {

        const newPoints = addPoints(member.id, -50);

        saveData();

        return interaction.reply({
          content:
            `⚠️ حاولت استلام التكت مرة ثانية.\n` +
            `تم خصم **50 نقطة**.\n` +
            `نقاطك الآن: **${newPoints}**`
        });
      }
    }

    // ------------------------------------------
    // Close
    // ------------------------------------------

    if (interaction.customId === "ticket_close") {

      const member = interaction.member;
      const channel = interaction.channel;

      const ticket = data.tickets[channel.id];

      if (!ticket) {
        return interaction.reply({
          content: "❌ هذه ليست تكت.",
          ephemeral: true
        });
      }

      // صاحب التكت لا يستطيع إغلاقها
      if (ticket.ownerId === member.id) {
        return interaction.reply({
          content: "❌ لا يمكنك إغلاق التكت التي فتحتها.",
          ephemeral: true
        });
      }

      if (!isStaff(member)) {
        return interaction.reply({
          content: "❌ الإدارة فقط تستطيع إغلاق التكت.",
          ephemeral: true
        });
      }

      await interaction.reply({
        content: "🔒 سيتم إغلاق التكت خلال 5 ثوانٍ..."
      });

      setTimeout(async () => {

        delete data.tickets[channel.id];
        saveData();

        await channel.delete().catch(() => {});

      }, 5000);

      return;
    }
  }

  // ====================================================
  // أوامر Slash
  // ====================================================

  if (!interaction.isChatInputCommand()) return;

  // ====================================================
  // /ip
  // ====================================================

  if (interaction.commandName === "ip") {

    const embed = new EmbedBuilder()
      .setTitle(`🌐 ${SERVER_NAME}`)
      .setDescription(
        `**IP:**\n\`${SERVER_IP}\``
      )
      .setFooter({
        text: SERVER_NAME
      });

    return interaction.reply({
      embeds: [embed]
    });
  }

  // ====================================================
  // /نقاطي
  // ====================================================

  if (interaction.commandName === "نقاطي") {

    const points = getPoints(interaction.user.id);

    const rank = getRankByPoints(points);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("📊 نقاط الإدارة")
          .setDescription(
            `**العضو:** ${interaction.user}\n\n` +
            `**النقاط:** ${points}\n` +
            `**الرتبة المستحقة:** ${rank}`
          )
      ],
      ephemeral: true
    });
  }

  // ====================================================
  // /راتبي
  // ====================================================

  if (interaction.commandName === "راتبي") {

    const member = interaction.member;

    // الراتب من Sr Mod وما فوق
    if (!isSeniorStaff(member)) {
      return interaction.reply({
        content: "❌ الراتب متاح من رتبة **Sr Mod** وما فوق.",
        ephemeral: true
      });
    }

    const now = Date.now();
    const lastSalary = Number(data.salary[member.id] || 0);

    const DAY = 24 * 60 * 60 * 1000;

    if (now - lastSalary < DAY) {

      const remaining = DAY - (now - lastSalary);

      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor(
        (remaining % 3600000) / 60000
      );

      return interaction.reply({
        content:
          `❌ استلمت راتبك مسبقاً.\n` +
          `يمكنك استلام الراتب بعد **${hours} ساعة و ${minutes} دقيقة**.`,
        ephemeral: true
      });
    }

    data.salary[member.id] = now;

    const newPoints = addPoints(member.id, 12);

    await updateStaffRank(member);

    saveData();

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("💰 راتب الإدارة")
          .setDescription(
            `تم إضافة **+12 نقطة** إلى رصيدك.\n\n` +
            `نقاطك الآن: **${newPoints}**`
          )
      ]
    });
  }

  // ====================================================
  // /claim
  // ====================================================

  if (interaction.commandName === "claim") {

    const member = interaction.member;

    if (!isStaff(member)) {
      return interaction.reply({
        content: "❌ هذا الأمر للإدارة فقط.",
        ephemeral: true
      });
    }

    const channel = interaction.channel;
    const ticket = data.tickets[channel.id];

    if (!ticket) {
      return interaction.reply({
        content: "❌ يجب استخدام الأمر داخل التكت.",
        ephemeral: true
      });
    }

    // صاحب التكت لا يستلمها
    if (ticket.ownerId === member.id) {
      return interaction.reply({
        content: "❌ لا يمكنك استلام التكت التي فتحتها.",
        ephemeral: true
      });
    }

    if (ticket.claimedBy && ticket.claimedBy !== member.id) {
      return interaction.reply({
        content: `❌ التكت مستلمة بواسطة <@${ticket.claimedBy}>.`,
        ephemeral: true
      });
    }

    if (!ticket.claimCount[member.id]) {
      ticket.claimCount[member.id] = 0;
    }

    ticket.claimCount[member.id]++;

    if (ticket.claimCount[member.id] === 1) {

      ticket.claimedBy = member.id;

      const points = addPoints(member.id, 3);

      await updateStaffRank(member);

      saveData();

      return interaction.reply({
        content:
          `✅ <@${member.id}> استلم التكت.\n` +
          `**+3 نقاط**\n` +
          `نقاطك: **${points}**`
      });
    }

    const points = addPoints(member.id, -50);

    saveData();

    return interaction.reply({
      content:
        `⚠️ تم احتساب Claim ثاني في نفس التكت.\n` +
        `**-50 نقطة**\n` +
        `نقاطك: **${points}**`
    });
  }

  // ====================================================
  // /warn
  // ====================================================

  if (interaction.commandName === "warn") {

    const member = interaction.member;

    if (!isSeniorStaff(member)) {
      return interaction.reply({
        content: "❌ أمر Warn متاح من **Sr Mod** وما فوق.",
        ephemeral: true
      });
    }

    const target = interaction.options.getMember("العضو");
    const reason = interaction.options.getString("السبب");

    if (!target) {
      return interaction.reply({
        content: "❌ لم أجد العضو.",
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("⚠️ تحذير")
      .setDescription(
        `**العضو:** ${target}\n` +
        `**بواسطة:** ${member}\n` +
        `**السبب:** ${reason}`
      )
      .setFooter({
        text: SERVER_NAME
      });

    return interaction.reply({
      embeds: [embed]
    });
  }

  // ====================================================
  // /طلب_استاف
  // ====================================================

  if (interaction.commandName === "طلب_استاف") {

    const member = interaction.member;

    if (!isStaff(member)) {
      return interaction.reply({
        content: "❌ هذا الأمر للإدارة فقط.",
        ephemeral: true
      });
    }

    const guild = interaction.guild;
    const mentions = [];

    for (const roleName of SENIOR_STAFF_ROLES) {

      const role = guild.roles.cache.find(
        r => r.name.toLowerCase() === roleName.toLowerCase()
      );

      if (role) {
        mentions.push(`<@&${role.id}>`);
      }
    }

    return interaction.reply({
      content:
        `📢 **طلب استاف**\n\n` +
        `<@${member.id}> يحتاج حضور الإدارة.\n\n` +
        mentions.join(" ")
    });
  }

  // ====================================================
  // /setup-ticket
  // ====================================================

  if (interaction.commandName === "setup-ticket") {

    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.Administrator
      )
    ) {
      return interaction.reply({
        content: "❌ هذا الأمر للأدمن فقط.",
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎫 تذاكر الدعم | ${SERVER_NAME}`)
      .setDescription(
        "اضغط على الزر بالأسفل لفتح تكت.\n\n" +
        "سيتم إنشاء تكت خاصة بك ويتم إشعار الإدارة."
      )
      .setFooter({
        text: SERVER_NAME
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_ticket")
        .setLabel("فتح تكت")
        .setEmoji("🎫")
        .setStyle(ButtonStyle.Success)
    );

    return interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }
});

// ======================================================
// تسجيل الدخول
// ======================================================

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error(
    "❌ تأكد من وضع TOKEN و CLIENT_ID و GUILD_ID في ملف .env"
  );
  process.exit(1);
}

client.login(TOKEN);
