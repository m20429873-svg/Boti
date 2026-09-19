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

// =====================================================
// TOKEN
// =====================================================

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("❌ TOKEN غير موجود في Railway Variables");
  process.exit(1);
}

// =====================================================
// SERVER
// =====================================================

const SERVER_NAME = "Velora ✔";
const SERVER_IP = "VELORA010.aternos.me:51685";

const QURAN_RADIO_URL =
  "https://backup.qurango.net/radio/salma";

// =====================================================
// STAFF ROLES
// =====================================================

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

// =====================================================
// DATA
// =====================================================

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
    console.error("⚠️ data.json غير صالح.");
    data = {
      guilds: {}
    };
  }
}

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2)
    );
  } catch (error) {
    console.error(
      "❌ خطأ حفظ البيانات:",
      error
    );
  }
}

function getGuildData(guildId) {
  if (!data.guilds[guildId]) {
    data.guilds[guildId] = {
      points: {},
      salary: {},
      tickets: {},
      warns: {}
    };
  }

  const guildData = data.guilds[guildId];

  guildData.points ||= {};
  guildData.salary ||= {};
  guildData.tickets ||= {};
  guildData.warns ||= {};

  return guildData;
}

// =====================================================
// CLIENT
// =====================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// =====================================================
// VOICE
// =====================================================

const voiceData = new Map();

function stopQuran(guildId) {
  const info = voiceData.get(guildId);

  if (!info) return false;

  try {
    info.player.stop();
  } catch {}

  try {
    info.ffmpeg.kill();
  } catch {}

  try {
    info.connection.destroy();
  } catch {}

  voiceData.delete(guildId);

  return true;
}

function playQuran(guild, voiceChannel) {
  stopQuran(guild.id);

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true
  });

  const player = createAudioPlayer();

  const ffmpeg = spawn(
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

  const resource = createAudioResource(
    ffmpeg.stdout,
    {
      inputType: StreamType.Raw
    }
  );

  player.play(resource);
  connection.subscribe(player);

  voiceData.set(guild.id, {
    connection,
    player,
    ffmpeg,
    channelId: voiceChannel.id
  });

  player.on(
    AudioPlayerStatus.Idle,
    () => {
      if (voiceData.has(guild.id)) {
        try {
          player.play(resource);
        } catch {}
      }
    }
  );

  player.on(
    "error",
    error => {
      console.error(
        "❌ خطأ تشغيل القرآن:",
        error
      );
    }
  );

  connection.on(
    VoiceConnectionStatus.Disconnected,
    () => {
      if (voiceData.has(guild.id)) {
        setTimeout(() => {
          if (voiceData.has(guild.id)) {
            stopQuran(guild.id);
          }
        }, 5000);
      }
    }
  );

  ffmpeg.on(
    "error",
    error => {
      console.error(
        "❌ FFmpeg Error:",
        error
      );
    }
  );

  return true;
}

// =====================================================
// ROLES
// =====================================================

function hasRole(member, roleName) {
  if (!member || !member.roles) {
    return false;
  }

  return member.roles.cache.some(
    role =>
      role.name.toLowerCase() ===
      roleName.toLowerCase()
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

// =====================================================
// POINTS
// =====================================================

function getPoints(guildId, userId) {
  const guildData =
    getGuildData(guildId);

  return Number(
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

  const oldPoints =
    Number(
      guildData.points[userId] || 0
    );

  const newPoints =
    Math.max(
      0,
      oldPoints + amount
    );

  guildData.points[userId] =
    newPoints;

  saveData();

  return newPoints;
}

// =====================================================
// COMMANDS
// =====================================================

const commands = [

  // ===================================================
  // IP
  // ===================================================

  new SlashCommandBuilder()
    .setName("ip")
    .setDescription("عرض IP السيرفر"),

  // ===================================================
  // POINTS
  // ===================================================

  new SlashCommandBuilder()
    .setName("points")
    .setDescription("عرض نقاطك"),

  // ===================================================
  // ADD POINTS
  // ===================================================

  new SlashCommandBuilder()
    .setName("addpoints")
    .setDescription("إضافة نقاط لعضو")
    .addUserOption(option =>
      option
        .setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("عدد النقاط")
        .setMinValue(1)
        .setRequired(true)
    ),

  // ===================================================
  // MINUS POINTS
  // ===================================================

  new SlashCommandBuilder()
    .setName("minuspoints")
    .setDescription("خصم نقاط من عضو")
    .addUserOption(option =>
      option
        .setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("عدد النقاط")
        .setMinValue(1)
        .setRequired(true)
    ),

  // ===================================================
  // SALARY
  // ===================================================

  new SlashCommandBuilder()
    .setName("salary")
    .setDescription("استلام راتب الإدارة"),

  // ===================================================
  // PROFILE - OWNER ONLY
  // ===================================================

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("عرض بروفايل عضو الإدارة")
    .addUserOption(option =>
      option
        .setName("member")
        .setDescription("العضو الذي تريد عرض بروفايله")
        .setRequired(false)
    ),

  // ===================================================
  // CLAIM
  // ===================================================

  new SlashCommandBuilder()
    .setName("claim")
    .setDescription("استلام التكت"),

  // ===================================================
  // WARN
  // ===================================================

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("تحذير عضو")
    .addUserOption(option =>
      option
        .setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("سبب التحذير")
        .setRequired(true)
    ),

  // ===================================================
  // STAFF REQUEST
  // ===================================================

  new SlashCommandBuilder()
    .setName("staffrequest")
    .setDescription("طلب تدخل الإدارة"),

  // ===================================================
  // SETUP TICKET
  // ===================================================

  new SlashCommandBuilder()
    .setName("setup-ticket")
    .setDescription("إنشاء لوحة التكت"),

  // ===================================================
  // QURAN
  // ===================================================

  new SlashCommandBuilder()
    .setName("quran")
    .setDescription("تشغيل القرآن في الروم الصوتي"),

  // ===================================================
  // QURAN STOP
  // ===================================================

  new SlashCommandBuilder()
    .setName("quran-stop")
    .setDescription("إيقاف القرآن")
];

// =====================================================
// REGISTER COMMANDS
// =====================================================

async function registerCommands() {
  try {
    const rest =
      new REST({ version: "10" })
        .setToken(TOKEN);

    console.log(
      "🔄 تسجيل أوامر Boti..."
    );

    await rest.put(
      Routes.applicationCommands(
        client.user.id
      ),
      {
        body: commands.map(
          command => command.toJSON()
        )
      }
    );

    console.log(
      "✅ تم تسجيل الأوامر Global"
    );

  } catch (error) {
    console.error(
      "❌ خطأ تسجيل الأوامر:",
      error
    );
  }
}

// =====================================================
// READY
// =====================================================

client.once(
  "ready",
  async () => {

    console.log(
      `✅ Boti Online: ${client.user.tag}`
    );

    console.log(
      `🌐 Server: ${SERVER_NAME}`
    );

    console.log(
      `📡 IP: ${SERVER_IP}`
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
  }
);

// =====================================================
// INTERACTIONS
// =====================================================

client.on(
  "interactionCreate",
  async interaction => {

    try {

      // =================================================
      // BUTTONS
      // =================================================

      if (
        interaction.isButton()
      ) {

        // ===============================================
        // OPEN TICKET
        // ===============================================

        if (
          interaction.customId ===
          "open_ticket"
        ) {

          const guild =
            interaction.guild;

          const existing =
            guild.channels.cache.find(
              channel =>
                channel.type ===
                  ChannelType.GuildText &&
                channel.topic ===
                  `ticket-owner:${interaction.user.id}`
            );

          if (existing) {
            return interaction.reply({
              content:
                `❌ عندك تكت مفتوح بالفعل: ${existing}`,
              ephemeral: true
            });
          }

          const permissionOverwrites = [
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
            }
          ];

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
              permissionOverwrites.push({
                id: role.id,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.ReadMessageHistory
                ]
              });
            }
          }

          const channel =
            await guild.channels.create({
              name:
                `ticket-${interaction.user.username}`
                  .toLowerCase()
                  .replace(/[^a-z0-9-_]/g, "-")
                  .slice(0, 90),

              type:
                ChannelType.GuildText,

              topic:
                `ticket-owner:${interaction.user.id}`,

              permissionOverwrites
            });

          const guildData =
            getGuildData(guild.id);

          guildData.tickets[channel.id] = {
            ownerId: interaction.user.id,
            claimedBy: null,
            claimCount: 0
          };

          saveData();

          const staffMentions =
            STAFF_ROLES
              .map(roleName => {
                const role =
                  guild.roles.cache.find(
                    r =>
                      r.name.toLowerCase() ===
                      roleName.toLowerCase()
                  );

                return role
                  ? `<@&${role.id}>`
                  : null;
              })
              .filter(Boolean)
              .join(" ");

          const embed =
            new EmbedBuilder()
              .setColor(0x00ff88)
              .setTitle(
                "🎫 تكت جديد"
              )
              .setDescription(
                `أهلًا <@${interaction.user.id}>\n\n` +
                `انتظر أحد أعضاء الإدارة لمساعدتك.\n\n` +
                `**صاحب التكت:** <@${interaction.user.id}>\n` +
                `**السيرفر:** ${SERVER_NAME}`
              )
              .setFooter({
                text: SERVER_NAME
              })
              .setTimestamp();

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

          await channel.send({
            content:
              `${staffMentions}\n<@${interaction.user.id}>`,
            embeds: [embed],
            components: [buttons]
          });

          return interaction.reply({
            content:
              `✅ تم فتح التكت: ${channel}`,
            ephemeral: true
          });
        }

        // ===============================================
        // CLAIM TICKET
        // ===============================================

        if (
          interaction.customId ===
          "ticket_claim"
        ) {

          const member =
            interaction.member;

          if (!isStaff(member)) {
            return interaction.reply({
              content:
                "❌ هذا الزر للإدارة فقط.",
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
                "❌ بيانات التكت غير موجودة.",
              ephemeral: true
            });
          }

          if (
            ticket.ownerId ===
            interaction.user.id
          ) {
            return interaction.reply({
              content:
                "❌ لا يمكنك استلام تكتك.",
              ephemeral: true
            });
          }

          // أول استلام
          if (
            !ticket.claimedBy
          ) {

            ticket.claimedBy =
              interaction.user.id;

            ticket.claimCount = 1;

            addPoints(
              interaction.guild.id,
              interaction.user.id,
              3
            );

            await interaction.reply({
              content:
                `✅ تم استلام التكت.\n` +
                `💰 +3 نقاط لك.`,
            });

            return;
          }

          // نفس الشخص يستلم مرة ثانية
          if (
            ticket.claimedBy ===
            interaction.user.id
          ) {

            ticket.claimCount =
              Number(
                ticket.claimCount || 0
              ) + 1;

            addPoints(
              interaction.guild.id,
              interaction.user.id,
              -50
            );

            await interaction.reply({
              content:
                `⚠️ لقد استلمت هذا التكت من قبل.\n` +
                `💸 تم خصم 50 نقطة.`,
            });

            return;
          }

          return interaction.reply({
            content:
              `❌ التكت مستلم بالفعل بواسطة <@${ticket.claimedBy}>.`,
            ephemeral: true
          });
        }

        // ===============================================
        // CLOSE TICKET
        // ===============================================

        if (
          interaction.customId ===
          "ticket_close"
        ) {

          const member =
            interaction.member;

          if (!isStaff(member)) {
            return interaction.reply({
              content:
                "❌ الإدارة فقط تستطيع إغلاق التكت.",
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
                "❌ بيانات التكت غير موجودة.",
              ephemeral: true
            });
          }

          if (
            ticket.ownerId ===
            interaction.user.id
          ) {
            return interaction.reply({
              content:
                "❌ لا يمكنك إغلاق تكتك بنفسك.",
              ephemeral: true
            });
          }

          await interaction.reply({
            content:
              "🔒 سيتم إغلاق التكت خلال 5 ثواني..."
          });

          setTimeout(
            async () => {

              try {
                delete guildData.tickets[
                  interaction.channel.id
                ];

                saveData();

                await interaction.channel.delete();

              } catch {}
            },
            5000
          );

          return;
        }
      }

      // =================================================
      // SLASH COMMANDS
      // =================================================

      if (
        !interaction.isChatInputCommand()
      ) {
        return;
      }

      // =================================================
      // IP
      // =================================================

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
              `**IP السيرفر:**\n\`\`\`\n${SERVER_IP}\n\`\`\``
            )
            .setFooter({
              text: SERVER_NAME
            })
            .setTimestamp();

        return interaction.reply({
          embeds: [embed]
        });
      }

      // =================================================
      // POINTS
      // =================================================

      if (
        interaction.commandName ===
        "points"
      ) {

        const points =
          getPoints(
            interaction.guild.id,
            interaction.user.id
          );

        return interaction.reply({
          content:
            `💰 نقاطك الحالية: **${points}**`,
          ephemeral: true
        });
      }

      // =================================================
      // ADD POINTS
      // OWNER ONLY
      // =================================================

      if (
        interaction.commandName ===
        "addpoints"
      ) {

        if (
          !hasRole(
            interaction.member,
            "Owner"
          )
        ) {
          return interaction.reply({
            content:
              "❌ هذا الأمر متاح للـ **Owner** فقط.",
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

        const newPoints =
          addPoints(
            interaction.guild.id,
            target.id,
            amount
          );

        return interaction.reply({
          content:
            `✅ تمت إضافة **${amount}** نقطة إلى <@${target.id}>.\n` +
            `💰 نقاطه الآن: **${newPoints}**`
        });
      }

      // =================================================
      // MINUS POINTS
      // OWNER ONLY
      // =================================================

      if (
        interaction.commandName ===
        "minuspoints"
      ) {

        if (
          !hasRole(
            interaction.member,
            "Owner"
          )
        ) {
          return interaction.reply({
            content:
              "❌ هذا الأمر متاح للـ **Owner** فقط.",
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

        const newPoints =
          addPoints(
            interaction.guild.id,
            target.id,
            -amount
          );

        return interaction.reply({
          content:
            `✅ تم خصم **${amount}** نقطة من <@${target.id}>.\n` +
            `💰 نقاطه الآن: **${newPoints}**`
        });
      }

      // =================================================
      // PROFILE
      // OWNER ONLY
      // =================================================

      if (
        interaction.commandName ===
        "profile"
      ) {

        if (
          !hasRole(
            interaction.member,
            "Owner"
          )
        ) {
          return interaction.reply({
            content:
              "❌ هذا الأمر متاح للـ **Owner** فقط.",
            ephemeral: true
          });
        }

        const selectedUser =
          interaction.options.getUser(
            "member"
          );

        let target =
          interaction.member;

        if (selectedUser) {
          target =
            await interaction.guild.members
              .fetch(selectedUser.id)
              .catch(() => null);
        }

        if (!target) {
          return interaction.reply({
            content:
              "❌ لم أستطع العثور على العضو.",
            ephemeral: true
          });
        }

        const guildData =
          getGuildData(
            interaction.guild.id
          );

        const points =
          getPoints(
            interaction.guild.id,
            target.id
          );

        // -----------------------------------------------
        // الرتبة الحالية
        // -----------------------------------------------

        let currentRole =
          "لا توجد رتبة";

        for (
          const roleName of STAFF_ROLES
        ) {
          if (
            hasRole(
              target,
              roleName
            )
          ) {
            currentRole =
              roleName;
          }
        }

        // -----------------------------------------------
        // تاريخ دخول السيرفر
        // -----------------------------------------------

        const joinedAt =
          target.joinedTimestamp
            ? `<t:${Math.floor(
                target.joinedTimestamp / 1000
              )}:F>`
            : "غير معروف";

        // -----------------------------------------------
        // آخر راتب
        // -----------------------------------------------

        const lastSalary =
          guildData.salary[
            target.id
          ];

        const salaryDate =
          lastSalary
            ? `<t:${Math.floor(
                lastSalary / 1000
              )}:F>`
            : "لم يستلم راتبًا بعد";

        // -----------------------------------------------
        // ترتيب النقاط
        // -----------------------------------------------

        const ranking =
          Object.entries(
            guildData.points
          )
            .sort(
              (a, b) =>
                Number(b[1]) -
                Number(a[1])
            );

        const rankIndex =
          ranking.findIndex(
            ([userId]) =>
              userId === target.id
          );

        const top =
          rankIndex === -1
            ? "-"
            : `#${rankIndex + 1}`;

        // -----------------------------------------------
        // Avatar
        // -----------------------------------------------

        const avatar =
          target.user.displayAvatarURL({
            size: 1024,
            extension: "png"
          });

        // -----------------------------------------------
        // Embed
        // -----------------------------------------------

        const embed =
          new EmbedBuilder()
            .setColor(0x00aaff)
            .setTitle(
              `👤 Profile | ${target.user.username}`
            )
            .setThumbnail(avatar)
            .setDescription(
              `**العضو:** <@${target.id}>\n` +
              `**الرتبة:** ${currentRole}\n` +
              `**دخل السيرفر:** ${joinedAt}\n` +
              `**آخر راتب:** ${salaryDate}\n` +
              `**النقاط:** ${points}\n` +
              `**الترتيب:** ${top}`
            )
            .setFooter({
              text:
                `${SERVER_NAME} • Owner Profile`
            })
            .setTimestamp();

        return interaction.reply({
          embeds: [embed]
        });
      }

      // =================================================
      // SALARY
      // =================================================

      if (
        interaction.commandName ===
        "salary"
      ) {

        if (
          !isSeniorStaff(
            interaction.member
          )
        ) {
          return interaction.reply({
            content:
              "❌ أمر الراتب متاح من **Sr Mod** وفوق فقط.",
            ephemeral: true
          });
        }

        const guildData =
          getGuildData(
            interaction.guild.id
          );

        const now =
          Date.now();

        const lastSalary =
          guildData.salary[
            interaction.user.id
          ];

        const DAY =
          24 * 60 * 60 * 1000;

        if (
          lastSalary &&
          now - lastSalary <
            DAY
        ) {

          const remaining =
            DAY -
            (now - lastSalary);

          const hours =
            Math.ceil(
              remaining /
              (60 * 60 * 1000)
            );

          return interaction.reply({
            content:
              `⏳ لقد استلمت راتبك بالفعل.\n` +
              `يمكنك استلامه بعد حوالي **${hours} ساعة**.`,
            ephemeral: true
          });
        }

        guildData.salary[
          interaction.user.id
        ] = now;

        addPoints(
          interaction.guild.id,
          interaction.user.id,
          12
        );

        saveData();

        return interaction.reply({
          content:
            `💰 تم استلام راتبك بنجاح!\n` +
            `➕ حصلت على **12 نقطة**.\n` +
            `❌ البوت لن يغير رتبتك تلقائيًا.`
        });
      }

      // =================================================
      // CLAIM
      // =================================================

      if (
        interaction.commandName ===
        "claim"
      ) {

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
              "❌ هذا الأمر يعمل داخل التكت فقط.",
            ephemeral: true
          });
        }

        if (
          ticket.ownerId ===
          interaction.user.id
        ) {
          return interaction.reply({
            content:
              "❌ لا يمكنك استلام تكتك.",
            ephemeral: true
          });
        }

        if (
          !ticket.claimedBy
        ) {

          ticket.claimedBy =
            interaction.user.id;

          ticket.claimCount = 1;

          addPoints(
            interaction.guild.id,
            interaction.user.id,
            3
          );

          return interaction.reply({
            content:
              "✅ تم استلام التكت.\n💰 **+3 نقاط**"
          });
        }

        if (
          ticket.claimedBy ===
          interaction.user.id
        ) {

          ticket.claimCount =
            Number(
              ticket.claimCount || 0
            ) + 1;

          addPoints(
            interaction.guild.id,
            interaction.user.id,
            -50
          );

          return interaction.reply({
            content:
              "⚠️ استلمت التكت من قبل.\n💸 **-50 نقطة**"
          });
        }

        return interaction.reply({
          content:
            `❌ التكت مستلم بالفعل بواسطة <@${ticket.claimedBy}>.`,
          ephemeral: true
        });
      }

      // =================================================
      // WARN
      // =================================================

      if (
        interaction.commandName ===
        "warn"
      ) {

        if (
          !isSeniorStaff(
            interaction.member
          )
        ) {
          return interaction.reply({
            content:
              "❌ أمر التحذير متاح من **Sr Mod** وفوق فقط.",
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
              "❌ لم أجد العضو.",
            ephemeral: true
          });
        }

        if (
          target.id ===
          interaction.user.id
        ) {
          return interaction.reply({
            content:
              "❌ لا يمكنك تحذير نفسك.",
            ephemeral: true
          });
        }

        const guildData =
          getGuildData(
            interaction.guild.id
          );

        if (
          !guildData.warns[target.id]
        ) {
          guildData.warns[target.id] =
            [];
        }

        guildData.warns[target.id].push({
          moderator:
            interaction.user.id,
          reason,
          time: Date.now()
        });

        const warnCount =
          guildData.warns[
            target.id
          ].length;

        saveData();

        // Warn 4 = Timeout
        if (
          warnCount === 4
        ) {

          await target.timeout(
            24 * 60 * 60 * 1000,
            reason
          ).catch(() => {});

          return interaction.reply({
            content:
              `⚠️ تم إعطاء <@${target.id}> التحذير رقم **4**.\n` +
              `⏳ تم إعطاؤه Timeout لمدة 24 ساعة.\n` +
              `📝 السبب: ${reason}`
          });
        }

        // Warn 5 = Kick
        if (
          warnCount === 5
        ) {

          await target.kick(
            reason
          ).catch(() => {});

          return interaction.reply({
            content:
              `⚠️ وصل <@${target.id}> إلى التحذير رقم **5** وتم طرده.\n` +
              `📝 السبب: ${reason}`
          });
        }

        // Warn 6+ = Ban
        if (
          warnCount >= 6
        ) {

          await target.ban({
            reason
          }).catch(() => {});

          return interaction.reply({
            content:
              `🚫 وصل <@${target.id}> إلى التحذير رقم **${warnCount}** وتم حظره.\n` +
              `📝 السبب: ${reason}`
          });
        }

        return interaction.reply({
          content:
            `⚠️ تم تحذير <@${target.id}>.\n` +
            `📌 التحذير رقم: **${warnCount}**\n` +
            `📝 السبب: ${reason}`
        });
      }

      // =================================================
      // STAFF REQUEST
      // =================================================

      if (
        interaction.commandName ===
        "staffrequest"
      ) {

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

        const mentions =
          SENIOR_STAFF_ROLES
            .map(roleName => {

              const role =
                interaction.guild.roles.cache.find(
                  role =>
                    role.name.toLowerCase() ===
                    roleName.toLowerCase()
                );

              return role
                ? `<@&${role.id}>`
                : null;
            })
            .filter(Boolean)
            .join(" ");

        return interaction.reply({
          content:
            `📢 طلب تدخل إداري من <@${interaction.user.id}>\n\n${mentions}`
        });
      }

      // =================================================
      // SETUP TICKET
      // =================================================

      if (
        interaction.commandName ===
        "setup-ticket"
      ) {

        if (
          !isSeniorStaff(
            interaction.member
          )
        ) {
          return interaction.reply({
            content:
              "❌ هذا الأمر متاح من **Sr Mod** وفوق فقط.",
            ephemeral: true
          });
        }

        const embed =
          new EmbedBuilder()
            .setColor(0x00aaff)
            .setTitle(
              "🎫 الدعم الفني"
            )
            .setDescription(
              "اضغط على الزر بالأسفل لفتح تكت مع الإدارة."
            )
            .setFooter({
              text: SERVER_NAME
            });

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
                .setStyle(
                  ButtonStyle.Success
                )
            );

        await interaction.channel.send({
          embeds: [embed],
          components: [row]
        });

        return interaction.reply({
          content:
            "✅ تم إنشاء لوحة التكت.",
          ephemeral: true
        });
      }

      // =================================================
      // QURAN
      // =================================================

      if (
        interaction.commandName ===
        "quran"
      ) {

        if (
          !isSeniorStaff(
            interaction.member
          )
        ) {
          return interaction.reply({
            content:
              "❌ هذا الأمر متاح من **Sr Mod** وفوق فقط.",
            ephemeral: true
          });
        }

        const voiceChannel =
          interaction.member.voice.channel;

        if (!voiceChannel) {
          return interaction.reply({
            content:
              "❌ ادخل روم صوتي أولًا.",
            ephemeral: true
          });
        }

        playQuran(
          interaction.guild,
          voiceChannel
        );

        return interaction.reply({
          content:
            `📖 تم تشغيل القرآن في **${voiceChannel.name}**.`
        });
      }

      // =================================================
      // QURAN STOP
      // =================================================

      if (
        interaction.commandName ===
        "quran-stop"
      ) {

        if (
          !isSeniorStaff(
            interaction.member
          )
        ) {
          return interaction.reply({
            content:
              "❌ هذا الأمر متاح من **Sr Mod** وفوق فقط.",
            ephemeral: true
          });
        }

        const stopped =
          stopQuran(
            interaction.guild.id
          );

        if (!stopped) {
          return interaction.reply({
            content:
              "❌ القرآن غير مشغل حاليًا.",
            ephemeral: true
          });
        }

        return interaction.reply({
          content:
            "⏹️ تم إيقاف القرآن."
        });
      }

    } catch (error) {

      console.error(
        "❌ Interaction Error:",
        error
      );

      if (
        interaction.replied ||
        interaction.deferred
      ) {

        await interaction.followUp({
          content:
            "❌ حدث خطأ أثناء تنفيذ الأمر.",
          ephemeral: true
        }).catch(() => {});

      } else {

        await interaction.reply({
          content:
            "❌ حدث خطأ أثناء تنفيذ الأمر.",
          ephemeral: true
        }).catch(() => {});
      }
    }
  }
);

// =====================================================
// MESSAGE SYSTEM
// =====================================================

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

    // الإدارة مستثناة
    if (
      isStaff(
        message.member
      )
    ) {
      return;
    }

    const content =
      message.content || "";

    // =================================================
    // LINKS
    // =================================================

    const linkRegex =
      /(https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/)/i;

    if (
      linkRegex.test(content)
    ) {

      await message.delete()
        .catch(() => {});

      await message.channel.send({
        content:
          `⚠️ <@${message.author.id}> ممنوع إرسال الروابط.`
      }).then(msg => {
        setTimeout(
          () =>
            msg.delete()
              .catch(() => {}),
          5000
        );
      });

      return;
    }

    // =================================================
    // //
    // =================================================

    if (
      content.includes("//")
    ) {

      await message.delete()
        .catch(() => {});

      await message.channel.send({
        content:
          `⚠️ <@${message.author.id}> هذه الرسالة غير مسموحة.`
      }).then(msg => {
        setTimeout(
          () =>
            msg.delete()
              .catch(() => {}),
          5000
        );
      });

      return;
    }

    // =================================================
    // ANTI SPAM
    // =================================================

    const userId =
      message.author.id;

    const now =
      Date.now();

    const last =
      spamMap.get(userId) || 0;

    if (
      now - last < 10000
    ) {

      await message.delete()
        .catch(() => {});

      return;
    }

    spamMap.set(
      userId,
      now
    );
  }
);

// =====================================================
// LOGIN
// =====================================================

client.login(TOKEN);
