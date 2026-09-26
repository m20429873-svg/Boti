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
  Routes,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  StreamType
} = require("@discordjs/voice");

const ffmpegPath = require("ffmpeg-static");
const { spawn } = require("child_process");
const fs = require("fs");

// =========================
// TOKEN
// =========================

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("❌ TOKEN غير موجود في Railway Variables");
  process.exit(1);
}

// =========================
// SERVER
// =========================

const SERVER_NAME = "Velora ✔";
const SERVER_IP = "VELORA010.aternos.me:51685";

const WELCOME_CHANNEL_ID = "1529047234056949780";

const QURAN_RADIO_URL =
  "https://backup.qurango.net/radio/salma";

// =========================
// STAFF ROLES
// =========================

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

// =========================
// TRIAL / APPLICATION ROLES
// =========================

const TRIAL_ROLE_ID =
  "1519689717887533181";

const APPLICATION_STAFF_ROLE_IDS = [
  "1519690623521787904", // Admin
  "1519690801053962410", // Co Owner
  "1519690993727705178", // Hp Owner
  "1519691370720264222"  // Owner
];

const APPLICATION_CHANNEL_ID =
  "1553356242171338845";

// التقديمات المفتوحة حاليًا
const trialApplications = new Map();

// =========================
// DATA
// =========================

const DATA_FILE = "./data.json";

let data = {
  guilds: {}
};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );
  } catch (error) {
    console.error(
      "❌ خطأ في قراءة data.json"
    );
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
      warns: {}
    };

    saveData();
  }

  const guildData =
    data.guilds[guildId];

  if (!guildData.points)
    guildData.points = {};

  if (!guildData.salary)
    guildData.salary = {};

  if (!guildData.tickets)
    guildData.tickets = {};

  if (!guildData.warns)
    guildData.warns = {};

  return guildData;
}

// =========================
// CLIENT
// =========================

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

// =========================
// VOICE
// =========================

const voiceData = new Map();

function stopQuran(guildId) {

  const info =
    voiceData.get(guildId);

  if (!info) return;

  try {
    info.player.stop();
  } catch {}

  try {
    if (info.ffmpeg) {
      info.ffmpeg.kill();
    }
  } catch {}

  try {
    info.connection.destroy();
  } catch {}

  voiceData.delete(guildId);
}

async function playQuran(
  guild,
  voiceChannel
) {

  stopQuran(guild.id);

  const connection =
    joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator:
        guild.voiceAdapterCreator,
      selfDeaf: true
    });

  const player =
    createAudioPlayer();

  let ffmpeg;

  function createStream() {

    ffmpeg = spawn(
      ffmpegPath,
      [
        "-re",
        "-i",
        QURAN_RADIO_URL,
        "-f",
        "s16le",
        "-ar",
        "48000",
        "-ac",
        "2",
        "pipe:1"
      ],
      {
        stdio: [
          "ignore",
          "pipe",
          "ignore"
        ]
      }
    );

    const resource =
      createAudioResource(
        ffmpeg.stdout,
        {
          inputType:
            StreamType.Raw
        }
      );

    player.play(resource);
  }

  connection.subscribe(player);

  voiceData.set(
    guild.id,
    {
      connection,
      player,
      ffmpeg
    }
  );

  createStream();

  player.on(
    AudioPlayerStatus.Idle,
    () => {

      const info =
        voiceData.get(guild.id);

      if (!info) return;

      createStream();
    }
  );

  connection.on(
    VoiceConnectionStatus.Disconnected,
    () => {
      stopQuran(guild.id);
    }
  );

  player.on(
    "error",
    error => {
      console.error(
        "❌ خطأ في القرآن:",
        error
      );
    }
  );
}

// =========================
// ROLE HELPERS
// =========================

function hasRole(
  member,
  roleName
) {

  return member.roles.cache.some(
    role => role.name === roleName
  );
}

function isStaff(member) {

  return STAFF_ROLES.some(
    role => hasRole(member, role)
  );
}

function isSeniorStaff(member) {

  return SENIOR_STAFF_ROLES.some(
    role => hasRole(member, role)
  );
}

function getStaffRole(member) {

  for (
    const role of STAFF_ROLES
  ) {

    if (
      hasRole(member, role)
    ) {
      return role;
    }
  }

  return "Member";
}

// =========================
// APPLICATION HELPERS
// =========================

function canReviewTrialApplication(
  member
) {

  return APPLICATION_STAFF_ROLE_IDS.some(
    roleId =>
      member.roles.cache.has(roleId)
  );
}

function getTrialMention(guild) {

  const role =
    guild.roles.cache.get(
      TRIAL_ROLE_ID
    );

  if (!role) {
    return "❌ لم يتم العثور على رتبة Trial.";
  }

  return `<@&${TRIAL_ROLE_ID}>`;
}

// =========================
// POINTS
// =========================

function getPoints(
  guildId,
  userId
) {

  const guildData =
    getGuildData(guildId);

  return (
    guildData.points[userId] || 0
  );
}

function addPoints(
  guildId,
  userId,
  amount
) {

  const guildData =
    getGuildData(guildId);

  if (
    !guildData.points[userId]
  ) {
    guildData.points[userId] = 0;
  }

  guildData.points[userId] +=
    amount;

  if (
    guildData.points[userId] < 0
  ) {
    guildData.points[userId] = 0;
  }

  saveData();

  return guildData.points[userId];
}

// =========================
// TICKET HELPERS
// =========================

function getTicket(
  guildId,
  channelId
) {

  const guildData =
    getGuildData(guildId);

  return guildData.tickets[
    channelId
  ];
}

function isTicketChannel(
  channel
) {

  return (
    channel &&
    channel.type ===
      ChannelType.GuildText &&
    typeof channel.topic ===
      "string" &&
    channel.topic.startsWith(
      "ticket-owner:"
    )
  );
}

function getTicketOwnerId(
  channel
) {

  if (!channel.topic)
    return null;

  return channel.topic
    .replace(
      "ticket-owner:",
      ""
    )
    .trim();
}

function getSupportMentions(
  guild
) {

  const mentions = [];

  for (
    const roleName of STAFF_ROLES
  ) {

    const role =
      guild.roles.cache.find(
        role =>
          role.name === roleName
      );

    if (role) {
      mentions.push(
        `<@&${role.id}>`
      );
    }
  }

  return mentions.join(" ");
}

function createTicketButtons() {

  return [

    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            "ticket_claim"
          )
          .setLabel(
            "استلام التذكرة"
          )
          .setEmoji("👤")
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            "ticket_request"
          )
          .setLabel(
            "طلب استلام"
          )
          .setEmoji("🔄")
          .setStyle(
            ButtonStyle.Secondary
          )
      ),

    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            "ticket_owner"
          )
          .setLabel(
            "استدعاء صاحب التذكرة"
          )
          .setEmoji("📩")
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            "ticket_support"
          )
          .setLabel(
            "منشن الدعم"
          )
          .setEmoji("📢")
          .setStyle(
            ButtonStyle.Secondary
          )
      ),

    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            "ticket_add"
          )
          .setLabel(
            "إضافة عضو"
          )
          .setEmoji("➕")
          .setStyle(
            ButtonStyle.Success
          ),

        new ButtonBuilder()
          .setCustomId(
            "ticket_remove"
          )
          .setLabel(
            "إزالة عضو"
          )
          .setEmoji("➖")
          .setStyle(
            ButtonStyle.Danger
          )
      ),

    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            "ticket_delete"
          )
          .setLabel(
            "حذف التذكرة"
          )
          .setEmoji("🗑️")
          .setStyle(
            ButtonStyle.Danger
          )
      )
  ];
}

// =========================
// SLASH COMMANDS
// =========================

const commands = [

  new SlashCommandBuilder()
    .setName("ip")
    .setDescription(
      "عرض آيبي سيرفر Minecraft"
    ),

  new SlashCommandBuilder()
    .setName("points")
    .setDescription(
      "عرض نقاطك"
    ),

  new SlashCommandBuilder()
    .setName("addpoints")
    .setDescription(
      "إضافة نقاط لعضو"
    )
    .addUserOption(option =>
      option
        .setName("member")
        .setDescription(
          "العضو"
        )
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription(
          "عدد النقاط"
        )
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("minuspoints")
    .setDescription(
      "خصم نقاط من عضو"
    )
    .addUserOption(option =>
      option
        .setName("member")
        .setDescription(
          "العضو"
        )
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription(
          "عدد النقاط"
        )
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("salary")
    .setDescription(
      "استلام الراتب اليومي"
    ),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription(
      "عرض بروفايل عضو"
    )
    .addUserOption(option =>
      option
        .setName("member")
        .setDescription(
          "العضو"
        )
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("claim")
    .setDescription(
      "استلام التذكرة الحالية"
    ),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription(
      "تحذير عضو"
    )
    .addUserOption(option =>
      option
        .setName("member")
        .setDescription(
          "العضو"
        )
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription(
          "سبب التحذير"
        )
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("staffrequest")
    .setDescription(
      "طلب مساعدة من الإدارة"
    ),

  new SlashCommandBuilder()
    .setName("setup-ticket")
    .setDescription(
      "إنشاء لوحة التذاكر"
    ),

  new SlashCommandBuilder()
    .setName("setup-trial")
    .setDescription(
      "إنشاء لوحة التقديم على الإدارة"
    ),

  new SlashCommandBuilder()
    .setName("quran")
    .setDescription(
      "تشغيل القرآن في الروم الصوتي"
    ),

  new SlashCommandBuilder()
    .setName("quran-stop")
    .setDescription(
      "إيقاف القرآن"
    )

].map(
  command => command.toJSON()
);

// =========================
// READY
// =========================

client.once(
  "ready",
  async () => {

    console.log(
      `✅ ${client.user.tag} Online`
    );

    client.user.setPresence({
      activities: [
        {
          name:
            `${SERVER_NAME} | /ip`,
          type: 0
        }
      ],
      status: "online"
    });

    try {

      const rest =
        new REST({
          version: "10"
        }).setToken(
          TOKEN
        );

      await rest.put(
        Routes.applicationCommands(
          client.user.id
        ),
        {
          body: commands
        }
      );

      console.log(
        "✅ تم تسجيل أوامر Slash Commands"
      );

    } catch (error) {

      console.error(
        "❌ خطأ في تسجيل الأوامر:",
        error
      );
    }
  }
);

// =========================
// WELCOME
// =========================

client.on(
  "guildMemberAdd",
  async member => {

    try {

      const channel =
        member.guild.channels.cache.get(
          WELCOME_CHANNEL_ID
        );

      if (!channel) {

        console.error(
          "❌ لم يتم العثور على قناة الترحيب"
        );

        return;
      }

      const embed =
        new EmbedBuilder()
          .setColor(0x00aaff)
          .setDescription(
            `🌟 | مرحبا بك <@${member.id}>\n\n` +
            `🎊 سعداء بانضمامك إلى سيرفر **${SERVER_NAME}**\n\n` +
            `🚀 استمتع بالفعاليات والتحديات\n` +
            `📖 لا تنسَ الاطلاع على القوانين\n\n` +
            `✨ نتمنى لك إقامة ممتعة بيننا`
          )
          .setThumbnail(
            member.user.displayAvatarURL({
              size: 256
            })
          )
          .setFooter({
            text: SERVER_NAME
          })
          .setTimestamp();

      await channel.send({
        content:
          `<@${member.id}>`,
        embeds: [embed]
      });

    } catch (error) {

      console.error(
        "❌ خطأ في نظام الترحيب:",
        error
      );
    }
  }
);

// =========================
// INTERACTIONS
// =========================

client.on(
  "interactionCreate",
  async interaction => {

    try {

      // =====================
      // SLASH COMMANDS
      // =====================

      if (
        interaction.isChatInputCommand()
      ) {

        const guild =
          interaction.guild;

        if (!guild) {

          return interaction.reply({
            content:
              "❌ هذا الأمر يعمل داخل السيرفر فقط.",
            ephemeral: true
          });
        }

        const member =
          interaction.member;

        // =====================
        // IP
        // =====================

        if (
          interaction.commandName ===
          "ip"
        ) {

          const embed =
            new EmbedBuilder()
              .setColor(0x00aaff)
              .setTitle(
                `🌐 ${SERVER_NAME}`
              )
              .setDescription(
                `🎮 **IP السيرفر:**\n` +
                `\`${SERVER_IP}\``
              )
              .setFooter({
                text: SERVER_NAME
              });

          return interaction.reply({
            embeds: [embed]
          });
        }

        // =====================
        // POINTS
        // =====================

        if (
          interaction.commandName ===
          "points"
        ) {

          const points =
            getPoints(
              guild.id,
              interaction.user.id
            );

          return interaction.reply({
            content:
              `🏆 نقاطك الحالية في **${SERVER_NAME}**: **${points} نقطة**`,
            ephemeral: true
          });
        }

        // =====================
        // ADD POINTS
        // =====================

        if (
          interaction.commandName ===
          "addpoints"
        ) {

          if (
            !member.permissions.has(
              PermissionsBitField.Flags.Administrator
            )
          ) {

            return interaction.reply({
              content:
                "❌ هذا الأمر للمالك/الإدارة فقط.",
              ephemeral: true
            });
          }

          const target =
            interaction.options.getUser(
              "member"
            );

          const amount =
            interaction.options.getInteger(
              "amount"
            );

          if (amount <= 0) {

            return interaction.reply({
              content:
                "❌ يجب أن يكون عدد النقاط أكبر من 0.",
              ephemeral: true
            });
          }

          const total =
            addPoints(
              guild.id,
              target.id,
              amount
            );

          return interaction.reply(
            `✅ تمت إضافة **${amount} نقطة** إلى ${target}.\n🏆 المجموع: **${total}**`
          );
        }

        // =====================
        // MINUS POINTS
        // =====================

        if (
          interaction.commandName ===
          "minuspoints"
        ) {

          if (
            !member.permissions.has(
              PermissionsBitField.Flags.Administrator
            )
          ) {

            return interaction.reply({
              content:
                "❌ هذا الأمر للمالك/الإدارة فقط.",
              ephemeral: true
            });
          }

          const target =
            interaction.options.getUser(
              "member"
            );

          const amount =
            interaction.options.getInteger(
              "amount"
            );

          if (amount <= 0) {

            return interaction.reply({
              content:
                "❌ يجب أن يكون عدد النقاط أكبر من 0.",
              ephemeral: true
            });
          }

          const total =
            addPoints(
              guild.id,
              target.id,
              -amount
            );

          return interaction.reply(
            `✅ تم خصم **${amount} نقطة** من ${target}.\n🏆 المجموع: **${total}**`
          );
        }

        // =====================
        // SALARY
        // =====================

        if (
          interaction.commandName ===
          "salary"
        ) {

          // Trial وما فوق يستطيعون استلام الراتب
          if (
            !isStaff(member)
          ) {

            return interaction.reply({
              content:
                "❌ الراتب متاح لفريق الإدارة من رتبة Trial وما فوق.",
              ephemeral: true
            });
          }

          const guildData =
            getGuildData(
              guild.id
            );

          const lastSalary =
            guildData.salary[
              interaction.user.id
            ] || 0;

          const now =
            Date.now();

          const cooldown =
            24 * 60 * 60 * 1000;

          if (
            now - lastSalary <
            cooldown
          ) {

            const remaining =
              cooldown -
              (now - lastSalary);

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
                `⏳ استلمت راتبك بالفعل.\n` +
                `يمكنك استلامه بعد **${hours} ساعة و ${minutes} دقيقة**.`,
              ephemeral: true
            });
          }

          guildData.salary[
            interaction.user.id
          ] = now;

          const total =
            addPoints(
              guild.id,
              interaction.user.id,
              12
            );

          return interaction.reply(
            `💰 تم استلام راتبك!\n` +
            `🎖️ رتبتك: **${getStaffRole(member)}**\n` +
            `🏆 حصلت على **12 نقطة**.\n` +
            `📊 نقاطك الآن: **${total}**`
          );
        }

        // =====================
        // PROFILE
        // =====================

        if (
          interaction.commandName ===
          "profile"
        ) {

          if (
            !member.permissions.has(
              PermissionsBitField.Flags.Administrator
            )
          ) {

            return interaction.reply({
              content:
                "❌ هذا الأمر للإدارة فقط.",
              ephemeral: true
            });
          }

          const target =
            interaction.options.getMember(
              "member"
            ) || member;

          const points =
            getPoints(
              guild.id,
              target.id
            );

          const guildData =
            getGuildData(
              guild.id
            );

          const lastSalary =
            guildData.salary[
              target.id
            ];

          const ranking =
            Object.entries(
              guildData.points
            )
              .sort(
                (a, b) =>
                  b[1] - a[1]
              )
              .findIndex(
                ([id]) =>
                  id === target.id
              ) + 1;

          const embed =
            new EmbedBuilder()
              .setColor(0x00aaff)
              .setTitle(
                `👤 بروفايل ${target.user.username}`
              )
              .setThumbnail(
                target.user.displayAvatarURL({
                  size: 512
                })
              )
              .addFields(

                {
                  name: "🎖️ الرتبة",
                  value:
                    getStaffRole(
                      target
                    ),
                  inline: true
                },

                {
                  name: "🏆 النقاط",
                  value:
                    `${points}`,
                  inline: true
                },

                {
                  name: "📊 الترتيب",
                  value:
                    ranking > 0
                      ? `#${ranking}`
                      : "غير مصنف",
                  inline: true
                },

                {
                  name: "📅 تاريخ الدخول",
                  value:
                    target.joinedAt
                      ? `<t:${Math.floor(
                          target.joinedAt.getTime() /
                            1000
                        )}:D>`
                      : "غير معروف",
                  inline: true
                },

                {
                  name: "💰 آخر راتب",
                  value:
                    lastSalary
                      ? `<t:${Math.floor(
                          lastSalary /
                            1000
                        )}:R>`
                      : "لم يستلم",
                  inline: true
                }
              )
              .setFooter({
                text: SERVER_NAME
              })
              .setTimestamp();

          return interaction.reply({
            embeds: [embed]
          });
        }

        // =====================
        // CLAIM
        // =====================

        if (
          interaction.commandName ===
          "claim"
        ) {

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
            !isStaff(member)
          ) {

            return interaction.reply({
              content:
                "❌ ليس لديك صلاحية استلام التذاكر.",
              ephemeral: true
            });
          }

          const ownerId =
            getTicketOwnerId(
              interaction.channel
            );

          if (
            ownerId ===
            interaction.user.id
          ) {

            return interaction.reply({
              content:
                "❌ لا يمكنك استلام تذكرتك الخاصة.",
              ephemeral: true
            });
          }

          const ticket =
            getTicket(
              guild.id,
              interaction.channel.id
            );

          if (!ticket) {

            return interaction.reply({
              content:
                "❌ لم يتم العثور على بيانات التذكرة.",
              ephemeral: true
            });
          }

          if (ticket.claimedBy) {

            return interaction.reply({
              content:
                `❌ التذكرة مستلمة بالفعل من <@${ticket.claimedBy}>.`,
              ephemeral: true
            });
          }

          ticket.claimedBy =
            interaction.user.id;

          ticket.claimCount = 1;

          addPoints(
            guild.id,
            interaction.user.id,
            3
          );

          saveData();

          const embed =
            new EmbedBuilder()
              .setColor(0x00c853)
              .setTitle(
                "👤 تم استلام التذكرة"
              )
              .setDescription(
                `تم استلام التذكرة بواسطة ${interaction.user}\n\n` +
                `🏆 **+3 نقاط**\n` +
                `📌 المستلم: ${interaction.user}`
              )
              .setTimestamp();

          return interaction.reply({
            embeds: [embed]
          });
        }

        // =====================
        // WARN
        // =====================

        if (
          interaction.commandName ===
          "warn"
        ) {

          if (
            !isSeniorStaff(member)
          ) {

            return interaction.reply({
              content:
                "❌ التحذيرات متاحة للإدارة العليا فقط.",
              ephemeral: true
            });
          }

          const target =
            interaction.options.getMember(
              "member"
            );

          const reason =
            interaction.options.getString(
              "reason"
            );

          if (!target) {

            return interaction.reply({
              content:
                "❌ العضو غير موجود.",
              ephemeral: true
            });
          }

          const guildData =
            getGuildData(
              guild.id
            );

          if (
            !guildData.warns[
              target.id
            ]
          ) {

            guildData.warns[
              target.id
            ] = [];
          }

          guildData.warns[
            target.id
          ].push({
            moderator:
              interaction.user.id,
            reason,
            time:
              Date.now()
          });

          const count =
            guildData.warns[
              target.id
            ].length;

          saveData();

          if (count === 4) {

            await target.timeout(
              24 * 60 * 60 * 1000,
              reason
            );

            return interaction.reply(
              `⚠️ تم تحذير ${target}\n` +
              `📌 السبب: ${reason}\n` +
              `🔢 التحذير رقم: **${count}**\n` +
              `⏱️ تم إعطاؤه Timeout لمدة 24 ساعة.`
            );
          }

          if (count === 5) {

            await target.kick(
              reason
            );

            return interaction.reply(
              `⚠️ تم تحذير ${target}\n` +
              `📌 السبب: ${reason}\n` +
              `🔢 التحذير رقم: **${count}**\n` +
              `👢 تم طرد العضو.`
            );
          }

          if (count >= 6) {

            await target.ban({
              reason
            });

            return interaction.reply(
              `⚠️ تم تحذير ${target}\n` +
              `📌 السبب: ${reason}\n` +
              `🔢 التحذير رقم: **${count}**\n` +
              `🔨 تم حظر العضو.`
            );
          }

          return interaction.reply(
            `⚠️ تم تحذير ${target}\n` +
            `📌 السبب: ${reason}\n` +
            `🔢 التحذير رقم: **${count}**`
          );
        }

        // =====================
        // STAFF REQUEST
        // =====================

        if (
          interaction.commandName ===
          "staffrequest"
        ) {

          if (
            !isStaff(member)
          ) {

            return interaction.reply({
              content:
                "❌ هذا الأمر للطاقم فقط.",
              ephemeral: true
            });
          }

          const mentions =
            getSupportMentions(
              guild
            );

          return interaction.reply(
            `${mentions}\n📢 **طلب مساعدة من ${interaction.user}**`
          );
        }

        // =====================
        // SETUP TICKET
        // =====================

        if (
          interaction.commandName ===
          "setup-ticket"
        ) {

          if (
            !isSeniorStaff(member)
          ) {

            return interaction.reply({
              content:
                "❌ هذا الأمر للإدارة العليا فقط.",
              ephemeral: true
            });
          }

          const embed =
            new EmbedBuilder()
              .setColor(0x00aaff)
              .setTitle(
                "🎫 نظام التذاكر"
              )
              .setDescription(
                "للتواصل مع فريق الدعم وفتح تذكرة، اضغط على الزر بالأسفل.\n\n" +
                "📌 سيتم إنشاء تذكرة خاصة بك.\n" +
                "💬 يمكنك التحدث داخل التذكرة فقط.\n" +
                "🛡️ فريق الدعم هو المسؤول عن إدارة التذكرة."
              )
              .setFooter({
                text: SERVER_NAME
              });

          const button =
            new ActionRowBuilder()
              .addComponents(

                new ButtonBuilder()
                  .setCustomId(
                    "open_ticket"
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
            components: [button]
          });

          return interaction.reply({
            content:
              "✅ تم إنشاء لوحة التذاكر.",
            ephemeral: true
          });
        }

        // =====================
        // SETUP TRIAL
        // =====================

        if (
          interaction.commandName ===
          "setup-trial"
        ) {

          if (
            !canReviewTrialApplication(
              member
            )
          ) {

            return interaction.reply({
              content:
                "❌ هذا الأمر مخصص لـ Admin و Co Owner و Hp Owner و Owner فقط.",
              ephemeral: true
            });
          }

          const embed =
            new EmbedBuilder()
              .setColor(0x2b2d31)
              .setTitle(
                "🛡️ التقديم على الإدارة"
              )
              .setDescription(
                "هل ترغب بالانضمام إلى فريق الإدارة؟\n\n" +
                "اضغط على الزر بالأسفل وابدأ تقديمك.\n\n" +
                "📋 سيتم سؤالك عن:\n" +
                "• الاسم\n" +
                "• العمر\n" +
                "• من أين\n" +
                "• الخبرة في الإدارة\n" +
                "• سبب التقديم\n" +
                "• ماذا ستفعل إذا كان المخالف صديقك؟\n\n" +
                "⏳ بعد إرسال التقديم سيتم إرساله إلى الإدارة للمراجعة."
              )
              .setFooter({
                text: SERVER_NAME
              })
              .setTimestamp();

          const row =
            new ActionRowBuilder()
              .addComponents(

                new ButtonBuilder()
                  .setCustomId(
                    "start_trial_application"
                  )
                  .setLabel(
                    "تقديم إدارة"
                  )
                  .setEmoji("🛡️")
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
              "✅ تم إنشاء لوحة التقديم على الإدارة.",
            ephemeral: true
          });
        }

        // =====================
        // QURAN
        // =====================

        if (
          interaction.commandName ===
          "quran"
        ) {

          if (
            !isSeniorStaff(member)
          ) {

            return interaction.reply({
              content:
                "❌ هذا الأمر للإدارة العليا فقط.",
              ephemeral: true
            });
          }

          const voiceChannel =
            member.voice.channel;

          if (!voiceChannel) {

            return interaction.reply({
              content:
                "❌ يجب أن تكون داخل روم صوتي.",
              ephemeral: true
            });
          }

          await playQuran(
            guild,
            voiceChannel
          );

          return interaction.reply(
            `📖 تم تشغيل القرآن في **${voiceChannel.name}**`
          );
        }

        // =====================
        // QURAN STOP
        // =====================

        if (
          interaction.commandName ===
          "quran-stop"
        ) {

          if (
            !isSeniorStaff(member)
          ) {

            return interaction.reply({
              content:
                "❌ هذا الأمر للإدارة العليا فقط.",
              ephemeral: true
            });
          }

          stopQuran(
            guild.id
          );

          return interaction.reply(
            "⏹️ تم إيقاف القرآن."
          );
        }
      }

      // =========================
      // START TRIAL APPLICATION
      // =========================

      if (
        interaction.isButton() &&
        interaction.customId ===
          "start_trial_application"
      ) {

        if (
          trialApplications.has(
            interaction.user.id
          )
        ) {

          return interaction.reply({
            content:
              "❌ لديك تقديم مفتوح بالفعل. أكمل التقديم في الخاص.",
            ephemeral: true
          });
        }

        trialApplications.set(
          interaction.user.id,
          {
            guildId:
              interaction.guild.id,
            step: 0,
            answers: {},
            startedAt:
              Date.now()
          }
        );

        try {

          await interaction.user.send(
            "🛡️ **التقديم على الإدارة**\n\n" +
            "سنبدأ الآن التقديم.\n" +
            "أجب على كل سؤال برسالة واحدة.\n\n" +
            "📝 **السؤال 1/6**\n" +
            "ما اسمك؟"
          );

          return interaction.reply({
            content:
              "✅ تم إرسال التقديم إلى الخاص.\n📩 افتح الخاص مع البوت للبدء.",
            ephemeral: true
          });

        } catch {

          trialApplications.delete(
            interaction.user.id
          );

          return interaction.reply({
            content:
              "❌ لم أستطع إرسال رسالة خاصة لك. تأكد أن الرسائل الخاصة من السيرفر مفتوحة.",
            ephemeral: true
          });
        }
      }

      // =========================
      // TRIAL APPLICATION REVIEW
      // =========================

      if (
        interaction.isButton() &&
        (
          interaction.customId.startsWith(
            "trial_accept_"
          ) ||
          interaction.customId.startsWith(
            "trial_reject_"
          )
        )
      ) {

        const member =
          interaction.member;

        if (
          !canReviewTrialApplication(
            member
          )
        ) {

          return interaction.reply({
            content:
              "❌ فقط Admin و Co Owner و Hp Owner و Owner يستطيعون مراجعة طلبات الإدارة.",
            ephemeral: true
          });
        }

        const parts =
          interaction.customId.split(
            "_"
          );

        const action =
          parts[1];

        const userId =
          parts[2];

        let applicant;

        try {

          applicant =
            await client.users.fetch(
              userId
            );

        } catch {

          return interaction.reply({
            content:
              "❌ لم أستطع العثور على المتقدم.",
            ephemeral: true
          });
        }

        // =====================
        // REJECT
        // =====================

        if (
          action === "reject"
        ) {

          try {

            await applicant.send(
              "❌ **تم رفضك.**\n\n" +
              "شكرًا لك على تقديمك، ويمكنك التقديم مرة أخرى مستقبلًا."
            );

          } catch {}

          const disabledRow =
            new ActionRowBuilder()
              .addComponents(

                new ButtonBuilder()
                  .setCustomId(
                    "application_rejected"
                  )
                  .setLabel(
                    "تم الرفض"
                  )
                  .setEmoji("❌")
                  .setStyle(
                    ButtonStyle.Danger
                  )
                  .setDisabled(true),

                new ButtonBuilder()
                  .setCustomId(
                    "application_disabled"
                  )
                  .setLabel(
                    "مغلق"
                  )
                  .setStyle(
                    ButtonStyle.Secondary
                  )
                  .setDisabled(true)
              );

          await interaction.message.edit({
            components: [
              disabledRow
            ]
          });

          return interaction.reply({
            content:
              `❌ تم رفض تقديم ${applicant}.`,
            ephemeral: true
          });
        }

        // =====================
        // ACCEPT
        // =====================

        if (
          action === "accept"
        ) {

          const guild =
            interaction.guild;

          const target =
            await guild.members
              .fetch(userId)
              .catch(
                () => null
              );

          if (!target) {

            return interaction.reply({
              content:
                "❌ العضو لم يعد موجودًا في السيرفر.",
              ephemeral: true
            });
          }

          const trialRole =
            guild.roles.cache.get(
              TRIAL_ROLE_ID
            );

          if (!trialRole) {

            return interaction.reply({
              content:
                "❌ لم يتم العثور على رتبة Trial.",
              ephemeral: true
            });
          }

          try {

            await target.roles.add(
              trialRole,
              "تم قبول طلب الإدارة"
            );

          } catch (error) {

            console.error(
              "❌ خطأ في إعطاء Trial:",
              error
            );

            return interaction.reply({
              content:
                "❌ لم أستطع إعطاء العضو رتبة Trial. تأكد أن رتبة البوت أعلى من Trial.",
              ephemeral: true
            });
          }

          try {

            await applicant.send(
              "✅ **تم قبولك وستستلم رتبتك الآن.**\n\n" +
              `🎖️ رتبتك: <@&${TRIAL_ROLE_ID}>\n` +
              "🎉 أهلًا بك في فريق الإدارة."
            );

          } catch {}

          const disabledRow =
            new ActionRowBuilder()
              .addComponents(

                new ButtonBuilder()
                  .setCustomId(
                    "application_accepted"
                  )
                  .setLabel(
                    "تم القبول"
                  )
                  .setEmoji("✅")
                  .setStyle(
                    ButtonStyle.Success
                  )
                  .setDisabled(true),

                new ButtonBuilder()
                  .setCustomId(
                    "application_disabled"
                  )
                  .setLabel(
                    "مغلق"
                  )
                  .setStyle(
                    ButtonStyle.Secondary
                  )
                  .setDisabled(true)
              );

          await interaction.message.edit({
            components: [
              disabledRow
            ]
          });

          return interaction.reply({
            content:
              `✅ تم قبول ${applicant} وإعطاؤه رتبة Trial.`,
            ephemeral: true
          });
        }
      }

      // =========================
      // OPEN TICKET
      // =========================

      if (
        interaction.isButton() &&
        interaction.customId ===
          "open_ticket"
      ) {

        const guild =
          interaction.guild;

        const existing =
          guild.channels.cache.find(
            channel =>
              isTicketChannel(
                channel
              ) &&
              getTicketOwnerId(
                channel
              ) ===
                interaction.user.id
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
              `ticket-${interaction.user.username}`
                .toLowerCase()
                .replace(
                  /[^a-z0-9-_]/g,
                  ""
                )
                .slice(
                  0,
                  20
                ) ||
              `ticket-${interaction.user.id.slice(-4)}`,

            type:
              ChannelType.GuildText,

            topic:
              `ticket-owner:${interaction.user.id}`,

            permissionOverwrites: [

              {
                id: guild.id,
                deny: [
                  PermissionsBitField.Flags.ViewChannel
                ]
              },

              {
                id:
                  interaction.user.id,

                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.ReadMessageHistory,
                  PermissionsBitField.Flags.AttachFiles
                ]
              }
            ]
          });

        // إضافة صلاحيات جميع رتب الدعم
        for (
          const roleName of STAFF_ROLES
        ) {

          const role =
            guild.roles.cache.find(
              r =>
                r.name ===
                roleName
            );

          if (!role)
            continue;

          await channel.permissionOverwrites.edit(
            role.id,
            {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true,
              ManageMessages: true,
              AttachFiles: true
            }
          );
        }

        const guildData =
          getGuildData(
            guild.id
          );

        guildData.tickets[
          channel.id
        ] = {
          ownerId:
            interaction.user.id,
          claimedBy: null,
          claimCount: 0,
          createdAt:
            Date.now()
        };

        saveData();

        const embed =
          new EmbedBuilder()
            .setColor(0x00aaff)
            .setTitle(
              "🎫 تذكرة جديدة"
            )
            .setDescription(
              `أهلاً بك ${interaction.user} 👋\n\n` +
              `💬 يمكنك التحدث هنا مع فريق الدعم.\n` +
              `🛡️ فريق الدعم يستطيع إدارة التذكرة من الأزرار.\n\n` +
              `📌 **صاحب التذكرة:** ${interaction.user}\n` +
              `🔢 **رقم التذكرة:** ${channel.id}`
            )
            .setFooter({
              text: SERVER_NAME
            })
            .setTimestamp();

        await channel.send({
          content:
            `${interaction.user}\n\n${getSupportMentions(
              guild
            )}`,
          embeds: [embed],
          components:
            createTicketButtons()
        });

        return interaction.reply({
          content:
            `✅ تم فتح تذكرتك: ${channel}`,
          ephemeral: true
        });
      }

      // =========================
      // TICKET BUTTONS
      // =========================

      if (
        interaction.isButton() &&
        interaction.customId.startsWith(
          "ticket_"
        )
      ) {

        const guild =
          interaction.guild;

        const member =
          interaction.member;

        const channel =
          interaction.channel;

        if (
          !isTicketChannel(
            channel
          )
        ) {

          return interaction.reply({
            content:
              "❌ هذا الزر يعمل داخل التذاكر فقط.",
            ephemeral: true
          });
        }

        const ownerId =
          getTicketOwnerId(
            channel
          );

        // صاحب التذكرة يستطيع منشن Trial فقط
        if (
          interaction.user.id ===
            ownerId &&
          interaction.customId !==
            "ticket_support"
        ) {

          return interaction.reply({
            content:
              "❌ أنت صاحب التذكرة، صلاحيتك داخلها هي التحدث واستخدام زر منشن الدعم فقط.",
            ephemeral: true
          });
        }

        // باقي الأزرار للدعم
        if (
          interaction.customId !==
            "ticket_support" &&
          !isStaff(member)
        ) {

          return interaction.reply({
            content:
              "❌ هذا الخيار متاح لفريق الدعم فقط.",
            ephemeral: true
          });
        }

        const ticket =
          getTicket(
            guild.id,
            channel.id
          );

        if (!ticket) {

          return interaction.reply({
            content:
              "❌ بيانات التذكرة غير موجودة.",
            ephemeral: true
          });
        }

        // =====================
        // CLAIM
        // =====================

        if (
          interaction.customId ===
          "ticket_claim"
        ) {

          if (
            ticket.claimedBy
          ) {

            return interaction.reply({
              content:
                `❌ التذكرة مستلمة بالفعل من <@${ticket.claimedBy}>.`,
              ephemeral: true
            });
          }

          ticket.claimedBy =
            interaction.user.id;

          ticket.claimCount = 1;

          addPoints(
            guild.id,
            interaction.user.id,
            3
          );

          saveData();

          const embed =
            new EmbedBuilder()
              .setColor(0x00c853)
              .setTitle(
                "👤 تم استلام التذكرة"
              )
              .setDescription(
                `👤 **المستلم:** ${interaction.user}\n` +
                `🏆 **المكافأة:** +3 نقاط\n\n` +
                `📌 أصبحت هذه التذكرة تحت متابعة المستلم.`
              )
              .setTimestamp();

          return interaction.reply({
            embeds: [embed]
          });
        }

        // =====================
        // REQUEST CLAIM
        // =====================

        if (
          interaction.customId ===
          "ticket_request"
        ) {

          if (
            ticket.claimedBy
          ) {

            return interaction.reply({
              content:
                `❌ التذكرة مستلمة بالفعل من <@${ticket.claimedBy}>.`,
              ephemeral: true
            });
          }

          const mentions =
            getSupportMentions(
              guild
            );

          return interaction.reply(
            `${mentions}\n🔄 **${interaction.user} يطلب استلام هذه التذكرة.**`
          );
        }

        // =====================
        // CALL OWNER
        // =====================

        if (
          interaction.customId ===
          "ticket_owner"
        ) {

          return interaction.reply(
            `📩 <@${ownerId}> فريق الدعم يطلب حضورك إلى التذكرة.`
          );
        }

        // =====================
        // SUPPORT MENTION
        // =====================

        if (
          interaction.customId ===
          "ticket_support"
        ) {

          const trialMention =
            getTrialMention(
              guild
            );

          return interaction.reply(
            `📢 ${trialMention}\n` +
            `🛡️ صاحب التذكرة يطلب حضور الدعم.`
          );
        }

        // =====================
        // ADD MEMBER
        // =====================

        if (
          interaction.customId ===
          "ticket_add"
        ) {

          const modal =
            new ModalBuilder()
              .setCustomId(
                "ticket_add_modal"
              )
              .setTitle(
                "➕ إضافة عضو"
              );

          const input =
            new TextInputBuilder()
              .setCustomId(
                "member_id"
              )
              .setLabel(
                "ضع ID العضو"
              )
              .setPlaceholder(
                "123456789012345678"
              )
              .setStyle(
                TextInputStyle.Short
              )
              .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder()
              .addComponents(
                input
              )
          );

          return interaction.showModal(
            modal
          );
        }

        // =====================
        // REMOVE MEMBER
        // =====================

        if (
          interaction.customId ===
          "ticket_remove"
        ) {

          const modal =
            new ModalBuilder()
              .setCustomId(
                "ticket_remove_modal"
              )
              .setTitle(
                "➖ إزالة عضو"
              );

          const input =
            new TextInputBuilder()
              .setCustomId(
                "member_id"
              )
              .setLabel(
                "ضع ID العضو"
              )
              .setPlaceholder(
                "123456789012345678"
              )
              .setStyle(
                TextInputStyle.Short
              )
              .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder()
              .addComponents(
                input
              )
          );

          return interaction.showModal(
            modal
          );
        }

        // =====================
        // DELETE
        // =====================

        if (
          interaction.customId ===
          "ticket_delete"
        ) {

          await interaction.reply(
            "🗑️ سيتم حذف التذكرة خلال **5 ثوانٍ**."
          );

          setTimeout(
            async () => {

              try {

                const guildData =
                  getGuildData(
                    guild.id
                  );

                delete guildData
                  .tickets[
                    channel.id
                  ];

                saveData();

                await channel.delete();

              } catch (error) {

                console.error(
                  "❌ خطأ في حذف التذكرة:",
                  error
                );
              }

            },
            5000
          );
        }
      }

      // =========================
      // MODALS
      // =========================

      if (
        interaction.isModalSubmit()
      ) {

        const channel =
          interaction.channel;

        const guild =
          interaction.guild;

        if (
          !isTicketChannel(
            channel
          )
        ) {

          return interaction.reply({
            content:
              "❌ هذا النموذج يعمل داخل التذاكر فقط.",
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
              "❌ هذا الخيار لفريق الدعم فقط.",
            ephemeral: true
          });
        }

        const memberId =
          interaction.fields
            .getTextInputValue(
              "member_id"
            )
            .trim();

        let target;

        try {

          target =
            await guild.members.fetch(
              memberId
            );

        } catch {

          return interaction.reply({
            content:
              "❌ لم يتم العثور على العضو. تأكد من ID.",
            ephemeral: true
          });
        }

        // =====================
        // ADD
        // =====================

        if (
          interaction.customId ===
          "ticket_add_modal"
        ) {

          await channel.permissionOverwrites.edit(
            target.id,
            {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true,
              AttachFiles: true
            }
          );

          return interaction.reply(
            `➕ تمت إضافة ${target} إلى التذكرة.`
          );
        }

        // =====================
        // REMOVE
        // =====================

        if (
          interaction.customId ===
          "ticket_remove_modal"
        ) {

          const ownerId =
            getTicketOwnerId(
              channel
            );

          if (
            target.id === ownerId
          ) {

            return interaction.reply({
              content:
                "❌ لا يمكنك إزالة صاحب التذكرة.",
              ephemeral: true
            });
          }

          await channel.permissionOverwrites
            .delete(
              target.id
            )
            .catch(() => {});

          return interaction.reply(
            `➖ تمت إزالة ${target} من التذكرة.`
          );
        }
      }

    } catch (error) {

      console.error(
        "❌ Interaction Error:",
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {

        await interaction.reply({
          content:
            "❌ حدث خطأ أثناء تنفيذ العملية.",
          ephemeral: true
        }).catch(
          () => {}
        );
      }
    }
  }
);

// =========================
// MESSAGE SYSTEM
// =========================

client.on(
  "messageCreate",
  async message => {

    // =========================
    // TRIAL APPLICATION DM
    // =========================

    if (
      !message.guild &&
      !message.author.bot
    ) {

      const application =
        trialApplications.get(
          message.author.id
        );

      if (!application)
        return;

      const content =
        message.content.trim();

      if (!content)
        return;

      const step =
        application.step;

      // =====================
      // QUESTION 1
      // =====================

      if (step === 0) {

        application.answers.name =
          content;

        application.step = 1;

        return message.author.send(
          "📝 **السؤال 2/6**\n" +
          "كم عمرك؟"
        );
      }

      // =====================
      // QUESTION 2
      // =====================

      if (step === 1) {

        application.answers.age =
          content;

        application.step = 2;

        return message.author.send(
          "📝 **السؤال 3/6**\n" +
          "من وين أنت؟"
        );
      }

      // =====================
      // QUESTION 3
      // =====================

      if (step === 2) {

        application.answers.from =
          content;

        application.step = 3;

        return message.author.send(
          "📝 **السؤال 4/6**\n" +
          "هل عندك خبرة في الإدارة؟"
        );
      }

      // =====================
      // QUESTION 4
      // =====================

      if (step === 3) {

        application.answers.experience =
          content;

        application.step = 4;

        return message.author.send(
          "📝 **السؤال 5/6**\n" +
          "لماذا تريد أن تقدم إدارة؟"
        );
      }

      // =====================
      // QUESTION 5
      // =====================

      if (step === 4) {

        application.answers.reason =
          content;

        application.step = 5;

        return message.author.send(
          "📝 **السؤال 6/6**\n" +
          "ماذا ستفعل إذا كان المخالف هو صديقك؟"
        );
      }

      // =====================
      // QUESTION 6
      // =====================

      if (step === 5) {

        application.answers.friend =
          content;

        const guild =
          client.guilds.cache.get(
            application.guildId
          );

        if (!guild) {

          trialApplications.delete(
            message.author.id
          );

          return message.author.send(
            "❌ حدث خطأ، لم أستطع العثور على السيرفر."
          );
        }

        const applicationChannel =
          guild.channels.cache.get(
            APPLICATION_CHANNEL_ID
          );

        if (!applicationChannel) {

          trialApplications.delete(
            message.author.id
          );

          return message.author.send(
            "❌ حدث خطأ، لم أجد قناة التقديم."
          );
        }

        const embed =
          new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle(
              "🛡️ تقديم إدارة جديد"
            )
            .setDescription(
              `👤 **المتقدم:** ${message.author}\n\n` +
              `📝 **الاسم:** ${application.answers.name}\n` +
              `🎂 **العمر:** ${application.answers.age}\n` +
              `📍 **من وين:** ${application.answers.from}\n` +
              `🛡️ **خبرته في الإدارة:** ${application.answers.experience}\n` +
              `💭 **لماذا يريد أن يقدم إدارة:** ${application.answers.reason}\n` +
              `⚖️ **ماذا سيفعل إذا كان المخالف صديقه:** ${application.answers.friend}`
            )
            .setThumbnail(
              message.author.displayAvatarURL({
                size: 256
              })
            )
            .setFooter({
              text:
                `${SERVER_NAME} • طلب إدارة`
            })
            .setTimestamp();

        const row =
          new ActionRowBuilder()
            .addComponents(

              new ButtonBuilder()
                .setCustomId(
                  `trial_accept_${message.author.id}`
                )
                .setLabel(
                  "قبول"
                )
                .setEmoji("✅")
                .setStyle(
                  ButtonStyle.Success
                ),

              new ButtonBuilder()
                .setCustomId(
                  `trial_reject_${message.author.id}`
                )
                .setLabel(
                  "رفض"
                )
                .setEmoji("❌")
                .setStyle(
                  ButtonStyle.Danger
                )
            );

        await applicationChannel.send({
          content:
            `<@${message.author.id}>\n\n` +
            `🛡️ **تقديم جديد يحتاج مراجعة الإدارة**`,
          embeds: [embed],
          components: [row]
        });

        trialApplications.delete(
          message.author.id
        );

        return message.author.send(
          "⏳ **انتظر قليلًا حتى تراجع الإدارة طلبك.**\n\n" +
          "سيتم إبلاغك بالنتيجة في الخاص."
        );
      }

      return;
    }

    // =========================
    // SERVER MESSAGES
    // =========================

    if (!message.guild)
      return;

    if (message.author.bot)
      return;

    const member =
      message.member;

    // الدعم مستثنى من الحماية
    if (
      isStaff(member)
    )
      return;

    // =====================
    // LINKS
    // =====================

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
          `${message.author} ❌ يمنع إرسال الروابط هنا.`
        );

      setTimeout(
        () => {
          warning.delete()
            .catch(() => {});
        },
        5000
      );

      return;
    }

    // =====================
    // DOUBLE SLASH
    // =====================

    if (
      message.content.includes("//")
    ) {

      await message.delete()
        .catch(() => {});

      const warning =
        await message.channel.send(
          `${message.author} ❌ هذه الرسالة غير مسموحة.`
        );

      setTimeout(
        () => {
          warning.delete()
            .catch(() => {});
        },
        5000
      );

      return;
    }

    // =====================
    // SIMPLE ANTI SPAM
    // =====================

    const key =
      `${message.guild.id}-${message.author.id}`;

    if (!client.spamMap) {
      client.spamMap =
        new Map();
    }

    const last =
      client.spamMap.get(
        key
      );

    const now =
      Date.now();

    if (
      last &&
      now - last < 10000
    ) {

      await message.delete()
        .catch(() => {});

      return;
    }

    client.spamMap.set(
      key,
      now
    );
  }
);

// =========================
// LOGIN
// =========================

client.login(TOKEN);
