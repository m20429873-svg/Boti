require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus
} = require("@discordjs/voice");

const { spawn } = require("child_process");
const fs = require("fs");

/* =========================
   CONFIG
========================= */

const TOKEN = process.env.TOKEN;

const SERVER_NAME = "Velora ✔";
const SERVER_IP = "VELORA010.aternos.me:51685";

const WELCOME_CHANNEL_ID = "1529047234056949780";
const PLAYER_ROLE_ID = "1529895166704353361";

const QURAN_RADIO_URL =
  "https://backup.qurango.net/radio/salma";

/* العضو المحمي من المنشن */
const PROTECTED_USER_ID = "1005198713083404319";

/* مدة حماية المنشن */
const MENTION_COOLDOWN = 4 * 60 * 60 * 1000;

/* =========================
   ADMIN MENTION SYSTEM
========================= */

/*
   Admin وفوق فقط
   Jr Admin غير موجود هنا لأنه أقل من Admin
*/
const ADMIN_MENTION_ROLES = [
  "Admin",
  "Co Owner",
  "Hp Owner",
  "Owner"
];

/* Timeout لمدة 3 أيام */
const ADMIN_MENTION_TIMEOUT =
  3 * 24 * 60 * 60 * 1000;

/* =========================
   STAFF
========================= */

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

const SENIOR_STAFF_ROLES = [
  "Sr Mod",
  "Jr Admin",
  "Admin",
  "Co Owner",
  "Hp Owner",
  "Owner"
];

/* =========================
   TRIAL
========================= */

const TRIAL_ROLE_ID = "1519689717887533181";

const APPLICATION_STAFF_ROLE_IDS = [
  "1519690623521787904",
  "1519690801053962410",
  "1519690993727705178",
  "1519691370720264222"
];

const APPLICATION_CHANNEL_ID =
  "1553356242171338845";

/* =========================
   DATA
========================= */

const DATA_FILE = "./data.json";

let data = {
  guilds: {}
};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );
  } catch {
    data = {
      guilds: {}
    };
  }
}

function saveData() {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2)
  );
}

function getGuildData(guildId) {
  if (!data.guilds[guildId]) {
    data.guilds[guildId] = {
      points: {},
      salary: {},
      tickets: {},
      warns: {},
      mentionCooldowns: {}
    };

    saveData();
  }

  const guildData = data.guilds[guildId];

  guildData.points ??= {};
  guildData.salary ??= {};
  guildData.tickets ??= {};
  guildData.warns ??= {};
  guildData.mentionCooldowns ??= {};

  return guildData;
}

/* =========================
   CLIENT
========================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages
  ]
});

/* =========================
   VOICE / QURAN
========================= */

const voiceData = new Map();

async function playQuran(guild, voiceChannel) {
  try {
    const old = voiceData.get(guild.id);

    if (old) {
      try {
        old.player.stop();
      } catch {}

      try {
        old.connection.destroy();
      } catch {}

      try {
        old.ffmpeg?.kill();
      } catch {}

      voiceData.delete(guild.id);
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator:
        guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    const player = createAudioPlayer();

    connection.subscribe(player);

    let ffmpeg = null;

    function createStream() {
      ffmpeg = spawn("ffmpeg", [
        "-re",
        "-i",
        QURAN_RADIO_URL,
        "-analyzeduration",
        "0",
        "-loglevel",
        "0",
        "-f",
        "s16le",
        "-ar",
        "48000",
        "-ac",
        "2",
        "pipe:1"
      ]);

      const resource =
        createAudioResource(
          ffmpeg.stdout,
          {
            inputType: 1
          }
        );

      player.play(resource);

      const info =
        voiceData.get(guild.id);

      if (info) {
        info.ffmpeg = ffmpeg;
      }
    }

    voiceData.set(guild.id, {
      connection,
      player,
      ffmpeg
    });

    createStream();

    player.on(
      AudioPlayerStatus.Idle,
      () => {
        if (voiceData.has(guild.id)) {
          createStream();
        }
      }
    );

    connection.on(
      VoiceConnectionStatus.Disconnected,
      () => {
        const info =
          voiceData.get(guild.id);

        if (info) {
          try {
            info.ffmpeg?.kill();
          } catch {}

          try {
            info.connection.destroy();
          } catch {}
        }

        voiceData.delete(guild.id);
      }
    );

    return true;
  } catch (error) {
    console.error(
      "Quran error:",
      error
    );

    return false;
  }
}

function stopQuran(guildId) {
  const info = voiceData.get(guildId);

  if (!info) return false;

  try {
    info.player.stop();
  } catch {}

  try {
    info.ffmpeg?.kill();
  } catch {}

  try {
    info.connection.destroy();
  } catch {}

  voiceData.delete(guildId);

  return true;
}

/* =========================
   ROLE HELPERS
========================= */

function hasRoleByName(member, names) {
  return member.roles.cache.some(
    role => names.includes(role.name)
  );
}

function isStaff(member) {
  if (!member) return false;

  return hasRoleByName(
    member,
    STAFF_ROLES
  );
}

function isSeniorStaff(member) {
  if (!member) return false;

  return hasRoleByName(
    member,
    SENIOR_STAFF_ROLES
  );
}

function isAdminOrAbove(member) {
  if (!member) return false;

  return hasRoleByName(
    member,
    ADMIN_MENTION_ROLES
  );
}

function getStaffRole(member) {
  if (!member) return "Member";

  for (const roleName of STAFF_ROLES) {
    if (
      member.roles.cache.some(
        role => role.name === roleName
      )
    ) {
      return roleName;
    }
  }

  return "Member";
}

/* =========================
   POINTS
========================= */

function getPoints(guildId, userId) {
  const guildData =
    getGuildData(guildId);

  return guildData.points[userId] || 0;
}

function addPoints(
  guildId,
  userId,
  amount
) {
  const guildData =
    getGuildData(guildId);

  guildData.points[userId] =
    getPoints(guildId, userId) + amount;

  saveData();

  return guildData.points[userId];
}

function removePoints(
  guildId,
  userId,
  amount
) {
  const guildData =
    getGuildData(guildId);

  guildData.points[userId] =
    getPoints(guildId, userId) - amount;

  saveData();

  return guildData.points[userId];
}

/* =========================
   TICKET HELPERS
========================= */

function isTicketChannel(channel) {
  if (!channel) return false;

  return (
    channel.type ===
    ChannelType.GuildText &&
    channel.name.startsWith("ticket-")
  );
}

/* =========================
   WARN
========================= */

function addWarn(
  guildId,
  userId,
  reason
) {
  const guildData =
    getGuildData(guildId);

  if (!guildData.warns[userId]) {
    guildData.warns[userId] = [];
  }

  guildData.warns[userId].push({
    moderator: client.user.id,
    reason,
    time: Date.now()
  });

  saveData();

  return guildData.warns[userId].length;
}

/* =========================
   PROTECTED USER MENTION
========================= */

async function autoMentionWarn(message) {
  if (!message.guild) return false;

  const guildData =
    getGuildData(message.guild.id);

  const userId =
    message.author.id;

  const now = Date.now();

  const lastMention =
    guildData.mentionCooldowns[userId] || 0;

  /*
     أول منشن:
     يبدأ منه عداد 4 ساعات
  */
  if (
    !lastMention ||
    now - lastMention >=
      MENTION_COOLDOWN
  ) {
    guildData.mentionCooldowns[userId] =
      now;

    saveData();

    return false;
  }

  /*
     منشن مخالف داخل 4 ساعات
  */
  guildData.mentionCooldowns[userId] =
    now;

  const warnCount = addWarn(
    message.guild.id,
    userId,
    "منشن العضو الممنوع أكثر من مرة خلال 4 ساعات"
  );

  await message.delete().catch(() => {});

  const warning =
    await message.channel.send(
      `⚠️ ${message.author}\n\n` +
      `🚫 ممنوع منشن هذا العضو أكثر من مرة خلال 4 ساعات.\n` +
      `📌 السبب: **منشن العضو الممنوع**\n` +
      `⚠️ تم تسجيل **Warn** تلقائيًا.\n` +
      `🔢 عدد تحذيراتك: **${warnCount}**`
    );

  setTimeout(() => {
    warning.delete().catch(() => {});
  }, 10000);

  saveData();

  return true;
}

/* =========================
   ADMIN MENTION
========================= */

async function autoAdminMentionPunishment(
  message
) {
  if (!message.guild) return false;

  const member =
    message.member;

  if (!member) return false;

  /*
     الإدارة نفسها لا تتعاقب
  */
  if (isStaff(member)) {
    return false;
  }

  const guildData =
    getGuildData(message.guild.id);

  const userId =
    message.author.id;

  const now = Date.now();

  const cooldownKey =
    `admin_${userId}`;

  const lastMention =
    guildData.mentionCooldowns[
      cooldownKey
    ] || 0;

  const repeated =
    lastMention &&
    now - lastMention <
      MENTION_COOLDOWN;

  /*
     يبدأ / يعاد تشغيل عداد الأربع ساعات
     من آخر منشن مخالف
  */
  guildData.mentionCooldowns[
    cooldownKey
  ] = now;

  if (!repeated) {
    /*
       أول منشن للإدارة:
       Warn + Timeout 3 أيام
    */

    const warnCount = addWarn(
      message.guild.id,
      userId,
      "منشن الإدارة"
    );

    await message.delete().catch(() => {});

    await member
      .timeout(
        ADMIN_MENTION_TIMEOUT,
        "منشن الإدارة"
      )
      .catch(error => {
        console.log(
          "Timeout failed:",
          error.message
        );
      });

    const warning =
      await message.channel.send(
        `⚠️ ${message.author}\n\n` +
        `🚫 ممنوع منشن الإدارة.\n` +
        `📌 السبب: **منشن الإدارة**\n` +
        `⚠️ تم تسجيل **Warn** تلقائيًا.\n` +
        `⏱️ تم إعطاؤك **Timeout لمدة 3 أيام**.\n` +
        `🔢 عدد تحذيراتك: **${warnCount}**`
      );

    setTimeout(() => {
      warning.delete().catch(() => {});
    }, 10000);

    saveData();

    return true;
  }

  /*
     تكرار منشن الإدارة خلال 4 ساعات:
     Warn + Ban نهائي
  */

  const warnCount = addWarn(
    message.guild.id,
    userId,
    "تكرار منشن الإدارة خلال 4 ساعات"
  );

  await message.delete().catch(() => {});

  await message.guild.members
    .ban(userId, {
      reason:
        "تكرار منشن الإدارة خلال 4 ساعات"
    })
    .catch(error => {
      console.log(
        "Ban failed:",
        error.message
      );
    });

  const warning =
    await message.channel.send(
      `🔨 ${message.author} تم حظرك نهائيًا.\n\n` +
      `📌 السبب: **تكرار منشن الإدارة خلال 4 ساعات**\n` +
      `⚠️ تم تسجيل **Warn** تلقائيًا.\n` +
      `🔢 عدد تحذيراتك: **${warnCount}**`
    );

  setTimeout(() => {
    warning.delete().catch(() => {});
  }, 10000);

  saveData();

  return true;
}

/* =========================
   SLASH COMMANDS
========================= */

const commands = [

  new SlashCommandBuilder()
    .setName("ip")
    .setDescription("عرض معلومات السيرفر"),

  new SlashCommandBuilder()
    .setName("points")
    .setDescription("عرض نقاط عضو")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("العضو")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("addpoints")
    .setDescription("إضافة نقاط")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("عدد النقاط")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("minuspoints")
    .setDescription("خصم نقاط")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("عدد النقاط")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("salary")
    .setDescription("استلام الراتب اليومي"),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("عرض البروفايل"),

  new SlashCommandBuilder()
    .setName("claim")
    .setDescription("استلام التذكرة"),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("تحذير عضو")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("السبب")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("staffrequest")
    .setDescription("طلب دخول طاقم الإدارة"),

  new SlashCommandBuilder()
    .setName("setup-ticket")
    .setDescription("إعداد نظام التذاكر"),

  new SlashCommandBuilder()
    .setName("setup-trial")
    .setDescription("إعداد التقديم"),

  new SlashCommandBuilder()
    .setName("quran")
    .setDescription("تشغيل إذاعة القرآن"),

  new SlashCommandBuilder()
    .setName("quran-stop")
    .setDescription("إيقاف إذاعة القرآن")

].map(command =>
  command.toJSON()
);

/* =========================
   READY
========================= */

client.once("ready", async () => {
  console.log(
    `✅ Logged in as ${client.user.tag}`
  );

  try {
    await client.application.commands.set(
      commands
    );

    console.log(
      "✅ Slash commands registered"
    );
  } catch (error) {
    console.error(
      "Commands error:",
      error
    );
  }
});

/* =========================
   MEMBER JOIN
========================= */

client.on(
  "guildMemberAdd",
  async member => {

    /*
       Player تلقائيًا
    */
    const playerRole =
      member.guild.roles.cache.get(
        PLAYER_ROLE_ID
      );

    if (playerRole) {
      await member.roles
        .add(
          playerRole,
          "إعطاء رتبة Player تلقائيًا عند الدخول"
        )
        .catch(error => {
          console.log(
            "Player role error:",
            error.message
          );
        });
    }

    const channel =
      member.guild.channels.cache.get(
        WELCOME_CHANNEL_ID
      );

    if (!channel) return;

    const embed =
      new EmbedBuilder()
        .setTitle(
          `🎉 مرحبًا بك في ${SERVER_NAME}`
        )
        .setDescription(
          `🌟 | مرحباً بك ${member}\n\n` +
          `👤 تم إعطاؤك رتبة **Player** تلقائيًا.\n` +
          `🎮 استمتع بوقتك معنا!`
        )
        .setThumbnail(
          member.user.displayAvatarURL({
            dynamic: true
          })
        )
        .setFooter({
          text: SERVER_NAME
        })
        .setTimestamp();

    channel.send({
      embeds: [embed]
    }).catch(() => {});
  }
);

/* =========================
   INTERACTIONS
========================= */

client.on(
  "interactionCreate",
  async interaction => {

    try {

      /* =====================
         BUTTONS
      ===================== */

      if (interaction.isButton()) {

        if (
          interaction.customId ===
          "ticket_create"
        ) {

          const guild =
            interaction.guild;

          const existing =
            guild.channels.cache.find(
              channel =>
                channel.name ===
                `ticket-${interaction.user.username
                  .toLowerCase()
                  .replace(/[^a-z0-9]/g, "")}`
            );

          if (existing) {
            return interaction.reply({
              content:
                `❌ لديك تذكرة مفتوحة بالفعل: ${existing}`,
              ephemeral: true
            });
          }

          const channel =
            await guild.channels.create({
              name:
                `ticket-${interaction.user.username
                  .toLowerCase()
                  .replace(/[^a-z0-9]/g, "")}`,
              type: ChannelType.GuildText,
              permissionOverwrites: [
                {
                  id: guild.roles.everyone.id,
                  deny: [
                    PermissionsBitField.Flags.ViewChannel
                  ]
                },
                {
                  id: interaction.user.id,
                  allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory
                  ]
                },
                ...APPLICATION_STAFF_ROLE_IDS.map(
                  roleId => ({
                    id: roleId,
                    allow: [
                      PermissionsBitField.Flags.ViewChannel,
                      PermissionsBitField.Flags.SendMessages,
                      PermissionsBitField.Flags.ReadMessageHistory,
                      PermissionsBitField.Flags.ManageMessages
                    ]
                  })
                )
              ]
            });

          const guildData =
            getGuildData(guild.id);

          guildData.tickets[
            channel.id
          ] = {
            owner: interaction.user.id,
            created: Date.now(),
            claimedBy: null
          };

          saveData();

          const row =
            new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(
                    "ticket_close"
                  )
                  .setLabel("إغلاق التذكرة")
                  .setStyle(
                    ButtonStyle.Danger
                  )
              );

          await channel.send({
            content:
              `🎫 ${interaction.user}\n\n` +
              `مرحبًا بك في تذكرتك.\n` +
              `اكتب سبب فتح التذكرة وسيقوم أحد أفراد الإدارة بمساعدتك.`,
            components: [row]
          });

          return interaction.reply({
            content:
              `✅ تم إنشاء تذكرتك: ${channel}`,
            ephemeral: true
          });
        }

        if (
          interaction.customId ===
          "ticket_close"
        ) {

          if (
            !isStaff(
              interaction.member
            )
          ) {
            return interaction.reply({
              content:
                "❌ ليس لديك صلاحية إغلاق التذاكر.",
              ephemeral: true
            });
          }

          await interaction.reply({
            content:
              "🔒 سيتم إغلاق التذكرة..."
          });

          setTimeout(() => {
            interaction.channel
              .delete()
              .catch(() => {});
          }, 2000);

          return;
        }

        if (
          interaction.customId ===
          "trial_apply"
        ) {

          const modal =
            new ModalBuilder()
              .setCustomId(
                "trial_modal"
              )
              .setTitle(
                "تقديم الإدارة"
              );

          const age =
            new TextInputBuilder()
              .setCustomId("age")
              .setLabel("العمر")
              .setStyle(
                TextInputStyle.Short
              )
              .setRequired(true);

          const reason =
            new TextInputBuilder()
              .setCustomId("reason")
              .setLabel("لماذا تريد الانضمام للإدارة؟")
              .setStyle(
                TextInputStyle.Paragraph
              )
              .setRequired(true);

          const experience =
            new TextInputBuilder()
              .setCustomId("experience")
              .setLabel("خبرتك")
              .setStyle(
                TextInputStyle.Paragraph
              )
              .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder()
              .addComponents(age),
            new ActionRowBuilder()
              .addComponents(reason),
            new ActionRowBuilder()
              .addComponents(experience)
          );

          return interaction.showModal(
            modal
          );
        }
      }

      /* =====================
         MODAL
      ===================== */

      if (interaction.isModalSubmit()) {

        if (
          interaction.customId ===
          "trial_modal"
        ) {

          const age =
            interaction.fields.getTextInputValue(
              "age"
            );

          const reason =
            interaction.fields.getTextInputValue(
              "reason"
            );

          const experience =
            interaction.fields.getTextInputValue(
              "experience"
            );

          const channel =
            interaction.guild.channels.cache.get(
              APPLICATION_CHANNEL_ID
            );

          if (channel) {

            const embed =
              new EmbedBuilder()
                .setTitle(
                  "📋 طلب تقديم جديد"
                )
                .setDescription(
                  `👤 المتقدم: ${interaction.user}\n\n` +
                  `🎂 العمر: **${age}**\n\n` +
                  `📌 السبب:\n${reason}\n\n` +
                  `💻 الخبرة:\n${experience}`
                )
                .setColor(0x5865f2)
                .setTimestamp();

            await channel.send({
              content:
                APPLICATION_STAFF_ROLE_IDS
                  .map(
                    id => `<@&${id}>`
                  )
                  .join(" "),
              embeds: [embed]
            });
          }

          return interaction.reply({
            content:
              "✅ تم إرسال طلب التقديم للإدارة.",
            ephemeral: true
          });
        }
      }

      /* =====================
         SLASH
      ===================== */

      if (!interaction.isChatInputCommand())
        return;

      const command =
        interaction.commandName;

      /* IP */

      if (command === "ip") {

        return interaction.reply(
          `🎮 **${SERVER_NAME}**\n\n` +
          `📡 IP: \`${SERVER_IP}\`\n` +
          `🟢 Java + Bedrock`
        );
      }

      /* POINTS */

      if (command === "points") {

        const user =
          interaction.options.getUser(
            "user"
          ) || interaction.user;

        const points =
          getPoints(
            interaction.guild.id,
            user.id
          );

        return interaction.reply(
          `💰 نقاط ${user}: **${points}**`
        );
      }

      /* ADD POINTS */

      if (command === "addpoints") {

        if (
          !isSeniorStaff(
            interaction.member
          )
        ) {
          return interaction.reply({
            content:
              "❌ هذا الأمر للإدارة العليا فقط.",
            ephemeral: true
          });
        }

        const user =
          interaction.options.getUser(
            "user"
          );

        const amount =
          interaction.options.getInteger(
            "amount"
          );

        if (amount <= 0) {
          return interaction.reply({
            content:
              "❌ يجب أن يكون العدد أكبر من صفر.",
            ephemeral: true
          });
        }

        const total =
          addPoints(
            interaction.guild.id,
            user.id,
            amount
          );

        return interaction.reply(
          `✅ تمت إضافة **${amount}** نقطة إلى ${user}.\n💰 المجموع: **${total}**`
        );
      }

      /* MINUS POINTS */

      if (command === "minuspoints") {

        if (
          !isSeniorStaff(
            interaction.member
          )
        ) {
          return interaction.reply({
            content:
              "❌ هذا الأمر للإدارة العليا فقط.",
            ephemeral: true
          });
        }

        const user =
          interaction.options.getUser(
            "user"
          );

        const amount =
          interaction.options.getInteger(
            "amount"
          );

        if (amount <= 0) {
          return interaction.reply({
            content:
              "❌ يجب أن يكون العدد أكبر من صفر.",
            ephemeral: true
          });
        }

        const total =
          removePoints(
            interaction.guild.id,
            user.id,
            amount
          );

        return interaction.reply(
          `✅ تم خصم **${amount}** نقطة من ${user}.\n💰 المجموع: **${total}**`
        );
      }

      /* SALARY */

      if (command === "salary") {

        if (
          !isStaff(
            interaction.member
          )
        ) {
          return interaction.reply({
            content:
              "❌ الراتب متاح لأعضاء الإدارة فقط.",
            ephemeral: true
          });
        }

        const guildData =
          getGuildData(
            interaction.guild.id
          );

        const userId =
          interaction.user.id;

        const last =
          guildData.salary[userId] || 0;

        const now = Date.now();

        if (
          now - last <
          24 * 60 * 60 * 1000
        ) {

          const remaining =
            24 * 60 * 60 * 1000 -
            (now - last);

          const hours =
            Math.ceil(
              remaining /
                (60 * 60 * 1000)
            );

          return interaction.reply({
            content:
              `⏳ استلمت راتبك بالفعل.\nيمكنك استلامه بعد **${hours} ساعة تقريبًا**.`,
            ephemeral: true
          });
        }

        guildData.salary[userId] =
          now;

        const total =
          addPoints(
            interaction.guild.id,
            userId,
            12
          );

        saveData();

        return interaction.reply(
          `💰 تم استلام راتبك اليومي: **12 نقطة**.\n📊 نقاطك الآن: **${total}**`
        );
      }

      /* PROFILE */

      if (command === "profile") {

        const points =
          getPoints(
            interaction.guild.id,
            interaction.user.id
          );

        const role =
          getStaffRole(
            interaction.member
          );

        const embed =
          new EmbedBuilder()
            .setTitle(
              `👤 ${interaction.user.username}`
            )
            .setThumbnail(
              interaction.user.displayAvatarURL({
                dynamic: true
              })
            )
            .addFields(
              {
                name: "🎖️ الرتبة",
                value: role,
                inline: true
              },
              {
                name: "💰 النقاط",
                value: `${points}`,
                inline: true
              }
            )
            .setTimestamp();

        return interaction.reply({
          embeds: [embed]
        });
      }

      /* CLAIM */

      if (command === "claim") {

        if (
          !isTicketChannel(
            interaction.channel
          )
        ) {
          return interaction.reply({
            content:
              "❌ هذا الأمر يعمل داخل التذاكر فقط.",
            ephemeral: true
          });
        }

        if (
          !isStaff(
            interaction.member
          )
        ) {
          return interaction.reply({
            content:
              "❌ هذا الأمر للإدارة فقط.",
            ephemeral: true
          });
        }

        const guildData =
          getGuildData(
            interaction.guild.id
          );

        const ticket =
          guildData.tickets[
            interaction.channel.id
          ];

        if (!ticket) {
          return interaction.reply({
            content:
              "❌ لم يتم العثور على بيانات هذه التذكرة.",
            ephemeral: true
          });
        }

        if (!ticket.claimedBy) {

          ticket.claimedBy =
            interaction.user.id;

          const total =
            addPoints(
              interaction.guild.id,
              interaction.user.id,
              5
            );

          saveData();

          return interaction.reply(
            `🎫 ${interaction.user}\n\n` +
            `✅ تم استلام التذكرة.\n` +
            `💰 حصلت على **5 نقاط**.\n` +
            `📊 نقاطك: **${total}**`
          );
        }

        /*
           إذا حاول إداري آخر استلامها
        */
        if (
          ticket.claimedBy !==
          interaction.user.id
        ) {

          const total =
            removePoints(
              interaction.guild.id,
              interaction.user.id,
              50
            );

          return interaction.reply(
            `⚠️ ${interaction.user}\n\n` +
            `التذكرة مستلمة بالفعل من <@${ticket.claimedBy}>.\n` +
            `💸 تم خصم **50 نقطة**.\n` +
            `📊 نقاطك الآن: **${total}**`
          );
        }

        return interaction.reply({
          content:
            "⚠️ أنت مستلم هذه التذكرة بالفعل.",
          ephemeral: true
        });
      }

      /* WARN */

      if (command === "warn") {

        if (
          !isSeniorStaff(
            interaction.member
          )
        ) {
          return interaction.reply({
            content:
              "❌ تحتاج رتبة إدارية عليا.",
            ephemeral: true
          });
        }

        const user =
          interaction.options.getUser(
            "user"
          );

        const reason =
          interaction.options.getString(
            "reason"
          );

        const member =
          await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

        const count =
          addWarn(
            interaction.guild.id,
            user.id,
            reason
          );

        let action =
          "⚠️ تم تسجيل التحذير فقط.";

        /*
           4 Warn = Timeout 24 ساعة
           5 Warn = Kick
           6+ Warn = Ban
        */

        if (
          count === 4 &&
          member
        ) {

          await member
            .timeout(
              24 * 60 * 60 * 1000,
              reason
            )
            .catch(() => {});

          action =
            "⏱️ وصل العضو إلى 4 تحذيرات وتم إعطاؤه Timeout لمدة 24 ساعة.";
        }

        if (
          count === 5 &&
          member
        ) {

          await member
            .kick(reason)
            .catch(() => {});

          action =
            "👢 وصل العضو إلى 5 تحذيرات وتم طرده.";
        }

        if (
          count >= 6
        ) {

          await interaction.guild.members
            .ban(user.id, {
              reason
            })
            .catch(() => {});

          action =
            "🔨 وصل العضو إلى 6 تحذيرات وتم حظره.";
        }

        return interaction.reply(
          `⚠️ تم تحذير ${user}\n\n` +
          `📌 السبب: **${reason}**\n` +
          `🔢 عدد التحذيرات: **${count}**\n\n` +
          action
        );
      }

      /* STAFF REQUEST */

      if (
        command === "staffrequest"
      ) {

        const channel =
          interaction.guild.channels.cache.get(
            APPLICATION_CHANNEL_ID
          );

        if (!channel) {
          return interaction.reply({
            content:
              "❌ لم يتم العثور على قناة التقديم.",
            ephemeral: true
          });
        }

        const button =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  "trial_apply"
                )
                .setLabel(
                  "📋 تقديم على الإدارة"
                )
                .setStyle(
                  ButtonStyle.Primary
                )
            );

        await channel.send({
          content:
            `🤝 **تقديم الإدارة في ${SERVER_NAME}**\n\n` +
            `اضغط على الزر للتقديم.`,
          components: [button]
        });

        return interaction.reply({
          content:
            "✅ تم إرسال لوحة التقديم.",
          ephemeral: true
        });
      }

      /* SETUP TICKET */

      if (
        command === "setup-ticket"
      ) {

        if (
          !isSeniorStaff(
            interaction.member
          )
        ) {
          return interaction.reply({
            content:
              "❌ لا تملك الصلاحية.",
            ephemeral: true
          });
        }

        const row =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  "ticket_create"
                )
                .setLabel(
                  "🎫 فتح تذكرة"
                )
                .setStyle(
                  ButtonStyle.Primary
                )
            );

        await interaction.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                "🎫 نظام التذاكر"
              )
              .setDescription(
                "اضغط على الزر لفتح تذكرة مع الإدارة."
              )
          ],
          components: [row]
        });

        return interaction.reply({
          content:
            "✅ تم إعداد التذاكر.",
          ephemeral: true
        });
      }

      /* SETUP TRIAL */

      if (
        command === "setup-trial"
      ) {

        if (
          !isSeniorStaff(
            interaction.member
          )
        ) {
          return interaction.reply({
            content:
              "❌ لا تملك الصلاحية.",
            ephemeral: true
          });
        }

        const row =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  "trial_apply"
                )
                .setLabel(
                  "📋 تقديم"
                )
                .setStyle(
                  ButtonStyle.Success
                )
            );

        await interaction.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                "🤝 التقديم على الإدارة"
              )
              .setDescription(
                "اضغط على الزر واملأ نموذج التقديم."
              )
          ],
          components: [row]
        });

        return interaction.reply({
          content:
            "✅ تم إعداد التقديم.",
          ephemeral: true
        });
      }

      /* QURAN */

      if (
        command === "quran"
      ) {

        if (
          !interaction.member.voice.channel
        ) {
          return interaction.reply({
            content:
              "❌ ادخل روم صوتي أولًا.",
            ephemeral: true
          });
        }

        const success =
          await playQuran(
            interaction.guild,
            interaction.member.voice.channel
          );

        return interaction.reply(
          success
            ? "📖 تم تشغيل إذاعة القرآن."
            : "❌ حدث خطأ أثناء تشغيل الإذاعة."
        );
      }

      /* QURAN STOP */

      if (
        command === "quran-stop"
      ) {

        if (
          !isStaff(
            interaction.member
          )
        ) {
          return interaction.reply({
            content:
              "❌ الإدارة فقط تستطيع إيقاف الإذاعة.",
            ephemeral: true
          });
        }

        const stopped =
          stopQuran(
            interaction.guild.id
          );

        return interaction.reply(
          stopped
            ? "⏹️ تم إيقاف إذاعة القرآن."
            : "❌ لا توجد إذاعة تعمل حاليًا."
        );
      }

    } catch (error) {

      console.error(
        "Interaction error:",
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await interaction.reply({
          content:
            "❌ حدث خطأ غير متوقع.",
          ephemeral: true
        }).catch(() => {});
      }
    }
  }
);

/* =========================
   MESSAGE SYSTEM
========================= */

const spamMap = new Map();

client.on(
  "messageCreate",
  async message => {

    if (
      message.author.bot ||
      !message.guild
    ) {
      return;
    }

    const member =
      message.member;

    /* =====================
       ADMIN MENTION
    ===================== */

    let adminMentioned =
      message.mentions.roles.some(
        role =>
          ADMIN_MENTION_ROLES.includes(
            role.name
          )
      );

    /*
       كذلك لو عمل منشن لشخص رتبته
       Admin أو أعلى
    */

    if (
      !adminMentioned &&
      message.mentions.members.size
    ) {
      adminMentioned =
        message.mentions.members.some(
          mentionedMember =>
            isAdminOrAbove(
              mentionedMember
            )
        );
    }

    if (
      adminMentioned &&
      !isStaff(member)
    ) {

      const punished =
        await autoAdminMentionPunishment(
          message
        );

      if (punished) {
        return;
      }
    }

    /* =====================
       PROTECTED USER
    ===================== */

    if (
      message.mentions.users.has(
        PROTECTED_USER_ID
      )
    ) {

      if (!isStaff(member)) {

        const wasWarned =
          await autoMentionWarn(
            message
          );

        if (wasWarned) {
          return;
        }
      }
    }

    /* =====================
       STAFF EXEMPTION
    ===================== */

    if (isStaff(member)) {
      return;
    }

    /* =====================
       LINKS
    ===================== */

    const linkRegex =
      /(https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/)/i;

    if (
      linkRegex.test(
        message.content
      )
    ) {

      await message.delete()
        .catch(() => {});

      const warning =
        await message.channel.send(
          `🚫 ${message.author}\nممنوع إرسال الروابط في هذا الشات.`
        );

      setTimeout(() => {
        warning.delete()
          .catch(() => {});
      }, 5000);

      return;
    }

    /* =====================
       DOUBLE SLASH
    ===================== */

    if (
      message.content.includes("//")
    ) {

      await message.delete()
        .catch(() => {});

      return;
    }

    /* =====================
       SPAM
    ===================== */

    const userId =
      message.author.id;

    const now = Date.now();

    const userMessages =
      spamMap.get(userId) || [];

    const recent =
      userMessages.filter(
        time =>
          now - time < 5000
      );

    recent.push(now);

    spamMap.set(
      userId,
      recent
    );

    if (recent.length >= 5) {

      await message.member
        .timeout(
          10 * 1000,
          "Spam"
        )
        .catch(() => {});

      spamMap.delete(
        userId
      );

      const warning =
        await message.channel.send(
          `⚠️ ${message.author} تم إعطاؤك Timeout بسبب السبام.`
        );

      setTimeout(() => {
        warning.delete()
          .catch(() => {});
      }, 5000);

      return;
    }
  }
);

/* =========================
   ERROR HANDLERS
========================= */

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "Unhandled rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  error => {
    console.error(
      "Uncaught exception:",
      error
    );
  }
);

/* =========================
   LOGIN
========================= */

if (!TOKEN) {
  console.error(
    "❌ TOKEN غير موجود في Environment Variables"
  );
  process.exit(1);
}

client.login(TOKEN);
