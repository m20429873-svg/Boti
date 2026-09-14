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

// =====================================================
// TOKEN من Railway فقط
// =====================================================

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("❌ TOKEN غير موجود في Railway Variables");
  process.exit(1);
}

// =====================================================
// السيرفر
// =====================================================

const SERVER_NAME = "Velora ✔";
const SERVER_IP = "VELORA010.aternos.me:51685";

// =====================================================
// رتب الإدارة
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
// نقاط الترقية
// =====================================================

const RANK_POINTS = {
  Trial: 0,
  Helper: 50,
  "Sr Helper": 120,
  Mod: 250,
  "Sr Mod": 400,
  "Jr Admin": 600,
  Admin: 850,
  "Co Owner": 1200,
  "Hp Owner": 1700,
  Owner: 2500
};

// =====================================================
// البيانات
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
  } catch (error) {
    console.error("⚠️ data.json غير صالح، سيتم إنشاء بيانات جديدة.");
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
      "❌ خطأ في حفظ البيانات:",
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

    saveData();
  }

  const guildData = data.guilds[guildId];

  // حماية للبيانات القديمة
  if (!guildData.points) guildData.points = {};
  if (!guildData.salary) guildData.salary = {};
  if (!guildData.tickets) guildData.tickets = {};
  if (!guildData.warns) guildData.warns = {};

  return guildData;
}

// =====================================================
// البوت
// =====================================================

const client = new Client({

  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]

});

// =====================================================
// الرتب
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
// النقاط
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
// الرتبة المستحقة
// =====================================================

function getRankByPoints(points) {

  let rank = "Trial";

  for (
    const roleName of STAFF_ROLES
  ) {

    if (
      points >=
      RANK_POINTS[roleName]
    ) {

      rank = roleName;

    }

  }

  return rank;

}

// =====================================================
// تحديث رتبة الإدارة
// =====================================================

async function updateStaffRank(member) {

  try {

    const points =
      getPoints(
        member.guild.id,
        member.id
      );

    const wantedRank =
      getRankByPoints(points);

    const wantedRole =
      member.guild.roles.cache.find(
        role =>
          role.name.toLowerCase() ===
          wantedRank.toLowerCase()
      );

    if (!wantedRole) {
      console.log(
        `⚠️ رتبة ${wantedRank} غير موجودة.`
      );
      return;
    }

    for (
      const roleName of STAFF_ROLES
    ) {

      const oldRole =
        member.guild.roles.cache.find(
          role =>
            role.name.toLowerCase() ===
            roleName.toLowerCase()
        );

      if (
        oldRole &&
        oldRole.id !== wantedRole.id &&
        member.roles.cache.has(oldRole.id)
      ) {

        await member.roles
          .remove(oldRole)
          .catch(() => {});

      }

    }

    if (
      !member.roles.cache.has(
        wantedRole.id
      )
    ) {

      await member.roles
        .add(wantedRole)
        .catch(() => {});

    }

  } catch (error) {

    console.error(
      "❌ خطأ تحديث الرتبة:",
      error
    );

  }

}

// =====================================================
// الأوامر
// =====================================================

const commands = [

  new SlashCommandBuilder()
    .setName("ip")
    .setDescription("عرض IP السيرفر"),

  new SlashCommandBuilder()
    .setName("points")
    .setDescription("عرض نقاطك"),

  new SlashCommandBuilder()
    .setName("salary")
    .setDescription("استلام راتب الإدارة"),

  new SlashCommandBuilder()
    .setName("claim")
    .setDescription("استلام التكت"),

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

  new SlashCommandBuilder()
    .setName("staffrequest")
    .setDescription("طلب حضور الإدارة"),

  new SlashCommandBuilder()
    .setName("setup-ticket")
    .setDescription("إنشاء لوحة التكت")

].map(command =>
  command.toJSON()
);

// =====================================================
// تسجيل الأوامر
// لا يحتاج CLIENT_ID أو GUILD_ID
// =====================================================

async function registerCommands() {

  try {

    const rest =
      new REST({
        version: "10"
      }).setToken(TOKEN);

    const applicationId =
      client.user.id;

    console.log(
      "🔄 تسجيل أوامر Boti..."
    );

    await rest.put(
      Routes.applicationCommands(
        applicationId
      ),
      {
        body: commands
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
// تشغيل البوت
// =====================================================

client.once(
  "ready",
  async () => {

    console.log(
      "================================="
    );

    console.log(
      `✅ Boti Online: ${client.user.tag}`
    );

    console.log(
      `🌐 ${SERVER_NAME}`
    );

    console.log(
      `IP: ${SERVER_IP}`
    );

    console.log(
      "================================="
    );

    await registerCommands();

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

  }
);

// =====================================================
// منع الروابط + منع // + Anti Spam
// =====================================================

const lastMessage = new Map();

const LINK_REGEX =
  /(https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/)/i;

client.on(
  "messageCreate",
  async message => {

    if (
      !message.guild ||
      message.author.bot
    ) {
      return;
    }

    const member =
      message.member;

    const staff =
      isStaff(member);

    // الإدارة مستثناة
    if (staff) {
      return;
    }

    // =================================================
    // منع الروابط
    // =================================================

    if (
      LINK_REGEX.test(
        message.content
      )
    ) {

      await message.delete()
        .catch(() => {});

      const warning =
        await message.channel.send({

          content:
            `🚫 <@${message.author.id}> ممنوع إرسال الروابط في السيرفر.`

        }).catch(() => null);

      if (warning) {

        setTimeout(() => {

          warning.delete()
            .catch(() => {});

        }, 5000);

      }

      return;

    }

    // =================================================
    // منع أي كلام يحتوي //
    // =================================================

    if (
      message.content.includes("//")
    ) {

      await message.delete()
        .catch(() => {});

      const warning =
        await message.channel.send({

          content:
            `🚫 <@${message.author.id}> هذه الرسالة ممنوعة.`

        }).catch(() => null);

      if (warning) {

        setTimeout(() => {

          warning.delete()
            .catch(() => {});

        }, 5000);

      }

      return;

    }

    // =================================================
    // Anti Spam - 10 ثواني
    // =================================================

    const now =
      Date.now();

    const last =
      lastMessage.get(
        message.author.id
      ) || 0;

    if (
      now - last < 10000
    ) {

      await message.delete()
        .catch(() => {});

      const warning =
        await message.channel.send({

          content:
            `⏳ <@${message.author.id}> انتظر **10 ثوانٍ** قبل إرسال رسالة أخرى.`

        }).catch(() => null);

      if (warning) {

        setTimeout(() => {

          warning.delete()
            .catch(() => {});

        }, 5000);

      }

      return;

    }

    lastMessage.set(
      message.author.id,
      now
    );

  }
);

// =====================================================
// التفاعلات
// =====================================================

client.on(
  "interactionCreate",
  async interaction => {

    // =================================================
    // الأزرار
    // =================================================

    if (interaction.isButton()) {

      // =================================================
      // فتح تكت
      // =================================================

      if (
        interaction.customId ===
        "open_ticket"
      ) {

        // الرد فورًا لمنع:
        // Boti didn't respond in time

        await interaction.deferReply({
          ephemeral: true
        });

        const guild =
          interaction.guild;

        const member =
          interaction.member;

        try {

          // ===========================================
          // التأكد من عدم وجود تكت
          // ===========================================

          const existing =
            guild.channels.cache.find(
              channel =>
                channel.type ===
                  ChannelType.GuildText &&
                channel.topic ===
                  `ticket-owner:${member.id}`
            );

          if (existing) {

            return interaction.editReply({

              content:
                `❌ لديك تكت مفتوحة بالفعل: ${existing}`

            });

          }

          // ===========================================
          // اسم الغرفة
          // ===========================================

          let username =
            member.user.username
              .toLowerCase()
              .replace(
                /[^a-z0-9-_]/g,
                ""
              )
              .slice(0, 15);

          if (!username) {
            username = "user";
          }

          // ===========================================
          // إنشاء الغرفة
          // ===========================================

          const channel =
            await guild.channels.create({

              name:
                `ticket-${username}`,

              type:
                ChannelType.GuildText,

              topic:
                `ticket-owner:${member.id}`,

              permissionOverwrites: [

                {
                  id:
                    guild.id,

                  deny: [
                    PermissionsBitField.Flags.ViewChannel
                  ]

                },

                {
                  id:
                    member.id,

                  allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory
                  ]

                }

              ]

            });

          // ===========================================
          // صلاحيات الإدارة
          // ===========================================

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
                .create(
                  role,
                  {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                  }
                )
                .catch(error => {

                  console.log(
                    `⚠️ تعذر إعطاء صلاحية رتبة ${roleName}`
                  );

                });

            }

          }

          // ===========================================
          // حفظ التكت
          // ===========================================

          const guildData =
            getGuildData(
              guild.id
            );

          guildData.tickets[
            channel.id
          ] = {

            ownerId:
              member.id,

            claimedBy:
              null,

            claimCount: {}

          };

          saveData();

          // ===========================================
          // منشن الإدارة العليا
          // ===========================================

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

          // ===========================================
          // Embed التكت
          // ===========================================

          const embed =
            new EmbedBuilder()

              .setTitle(
                `🎫 تكت الدعم | ${SERVER_NAME}`
              )

              .setDescription(

                `مرحباً <@${member.id}> 👋\n\n` +

                `تم فتح التكت الخاصة بك بنجاح.\n\n` +

                `👤 **صاحب التكت:** <@${member.id}>\n` +

                `🛡️ **الإدارة:** سيتم الرد عليك قريباً.\n\n` +

                `✏️ اكتب طلبك بالتفصيل وانتظر فريق الإدارة.`

              )

              .setFooter({
                text:
                  SERVER_NAME
              });

          // ===========================================
          // أزرار التكت
          // ===========================================

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

          // ===========================================
          // الرسالة داخل التكت
          // ===========================================

          await channel.send({

            content:
              `<@${member.id}>` +
              (
                mentions.length
                  ? `\n${mentions.join(" ")}`
                  : ""
              ),

            embeds: [
              embed
            ],

            components: [
              buttons
            ]

          });

          // ===========================================
          // الرد للمستخدم
          // ===========================================

          await interaction.editReply({

            content:
              `✅ تم فتح تكتك بنجاح: ${channel}`

          });

          console.log(
            `🎫 تم إنشاء تكت ${channel.name} للعضو ${member.user.tag}`
          );

        } catch (error) {

          console.error(
            "❌ خطأ أثناء إنشاء التكت:",
            error
          );

          await interaction.editReply({

            content:
              "❌ حدث خطأ أثناء إنشاء التكت. تأكد أن البوت لديه صلاحية **Manage Channels** و **Manage Roles**."

          }).catch(() => {});

        }

        return;

      }

      // =================================================
      // استلام التكت
      // =================================================

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

        const guildData =
          getGuildData(
            interaction.guild.id
          );

        const ticket =
          guildData.tickets[
            channel.id
          ];

        if (!ticket) {

          return interaction.reply({

            content:
              "❌ هذه القناة ليست تكت.",

            ephemeral: true

          });

        }

        // صاحب التكت ممنوع
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

        // إذا شخص آخر مستلم التكت
        if (
          ticket.claimedBy &&
          ticket.claimedBy !==
            member.id
        ) {

          return interaction.reply({

            content:
              `❌ التكت مستلمة بواسطة <@${ticket.claimedBy}>.`,

            ephemeral: true

          });

        }

        if (
          !ticket.claimCount[
            member.id
          ]
        ) {

          ticket.claimCount[
            member.id
          ] = 0;

        }

        ticket.claimCount[
          member.id
        ]++;

        // أول Claim
        if (
          ticket.claimCount[
            member.id
          ] === 1
        ) {

          ticket.claimedBy =
            member.id;

          const points =
            addPoints(
              interaction.guild.id,
              member.id,
              3
            );

          await updateStaffRank(
            member
          );

          return interaction.reply({

            content:
              `✅ تم استلام التكت.\n\n` +
              `⭐ **+3 نقاط**\n` +
              `📊 نقاطك الآن: **${points}**`

          });

        }

        // Claim ثاني
        const points =
          addPoints(
            interaction.guild.id,
            member.id,
            -50
          );

        return interaction.reply({

          content:
            `⚠️ Claim ثاني لنفس التكت.\n\n` +
            `❌ **-50 نقطة**\n` +
            `📊 نقاطك الآن: **${points}**`

        });

      }

      // =================================================
      // إغلاق التكت
      // =================================================

      if (
        interaction.customId ===
        "ticket_close"
      ) {

        const member =
          interaction.member;

        const channel =
          interaction.channel;

        const guildData =
          getGuildData(
            interaction.guild.id
          );

        const ticket =
          guildData.tickets[
            channel.id
          ];

        if (!ticket) {

          return interaction.reply({

            content:
              "❌ هذه ليست تكت.",

            ephemeral: true

          });

        }

        // صاحب التكت ممنوع
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

            delete guildData.tickets[
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

    // =================================================
    // Slash Commands
    // =================================================

    if (
      !interaction.isChatInputCommand()
    ) {

      return;

    }

    // =================================================
    // /ip
    // =================================================

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

        embeds: [
          embed
        ]

      });

    }

    // =================================================
    // /points
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

              `⭐ **النقاط:** ${points}\n\n` +

              `🏆 **الرتبة المستحقة:** ${rank}`

            )

        ],

        ephemeral: true

      });

    }

    // =================================================
    // /salary
    // =================================================

    if (
      interaction.commandName ===
      "salary"
    ) {

      const member =
        interaction.member;

      if (
        !isSeniorStaff(member)
      ) {

        return interaction.reply({

          content:
            "❌ الراتب متاح من **Sr Mod** فما فوق.",

          ephemeral: true

        });

      }

      const guildData =
        getGuildData(
          interaction.guild.id
        );

      const now =
        Date.now();

      const last =
        Number(
          guildData.salary[
            member.id
          ] || 0
        );

      const DAY =
        24 * 60 * 60 * 1000;

      if (
        now - last < DAY
      ) {

        const remaining =
          DAY -
          (now - last);

        const hours =
          Math.floor(
            remaining /
            3600000
          );

        const minutes =
          Math.floor(
            (
              remaining %
              3600000
            ) /
            60000
          );

        return interaction.reply({

          content:
            `❌ استلمت راتبك مسبقاً.\n` +
            `⏰ المتبقي: **${hours} ساعة و ${minutes} دقيقة**`,

          ephemeral: true

        });

      }

      guildData.salary[
        member.id
      ] = now;

      const points =
        addPoints(
          interaction.guild.id,
          member.id,
          12
        );

      await updateStaffRank(
        member
      );

      return interaction.reply({

        embeds: [

          new EmbedBuilder()

            .setTitle(
              "💰 راتب الإدارة"
            )

            .setDescription(

              `✅ تم استلام الراتب.\n\n` +

              `⭐ **+12 نقطة**\n\n` +

              `📊 نقاطك الآن: **${points}**`

            )

        ]

      });

    }

    // =================================================
    // /claim
    // =================================================

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
        ticket.claimedBy !==
          member.id
      ) {

        return interaction.reply({

          content:
            `❌ التكت مستلمة بواسطة <@${ticket.claimedBy}>.`,

          ephemeral: true

        });

      }

      if (
        !ticket.claimCount[
          member.id
        ]
      ) {

        ticket.claimCount[
          member.id
        ] = 0;

      }

      ticket.claimCount[
        member.id
      ]++;

      if (
        ticket.claimCount[
          member.id
        ] === 1
      ) {

        ticket.claimedBy =
          member.id;

        const points =
          addPoints(
            interaction.guild.id,
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
          interaction.guild.id,
          member.id,
          -50
        );

      return interaction.reply({

        content:
          `⚠️ Claim ثاني لنفس التكت.\n` +
          `❌ **-50 نقطة**\n` +
          `📊 نقاطك: **${points}**`

      });

    }

    // =================================================
    // /warn
    // =================================================

    if (
      interaction.commandName ===
      "warn"
    ) {

      const moderator =
        interaction.member;

      if (!isSeniorStaff(moderator)) {

        return interaction.reply({

          content:
            "❌ أمر Warn متاح من **Sr Mod** فما فوق.",

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

      if (target.user.bot) {

        return interaction.reply({

          content:
            "❌ لا يمكنك تحذير البوتات.",

          ephemeral: true

        });

      }

      if (target.id === moderator.id) {

        return interaction.reply({

          content:
            "❌ لا يمكنك تحذير نفسك.",

          ephemeral: true

        });

      }

      // ===============================================
      // حماية من تحذير رتبة إدارية أعلى
      // ===============================================

      if (
        target.roles.highest.position >=
        moderator.roles.highest.position
      ) {

        return interaction.reply({

          content:
            "❌ لا يمكنك تحذير عضو رتبته مساوية أو أعلى من رتبتك.",

          ephemeral: true

        });

      }

      const guildData =
        getGuildData(
          interaction.guild.id
        );

      if (!guildData.warns[target.id]) {
        guildData.warns[target.id] = 0;
      }

      guildData.warns[target.id]++;

      const warnNumber =
        guildData.warns[target.id];

      saveData();

      // ===============================================
      // Warn 1
      // ===============================================

      if (warnNumber === 1) {

        return interaction.reply({

          embeds: [

            new EmbedBuilder()

              .setTitle(
                "⚠️ التحذير الأول"
              )

              .setDescription(

                `👤 **العضو:** ${target}\n` +
                `🛡️ **بواسطة:** ${moderator}\n` +
                `📝 **السبب:** ${reason}\n\n` +
                `⚠️ تم تسجيل **التحذير الأول**.`

              )

              .setFooter({
                text:
                  SERVER_NAME
              })

          ]

        });

      }

      // ===============================================
      // Warn 2
      // ===============================================

      if (warnNumber === 2) {

        return interaction.reply({

          embeds: [

            new EmbedBuilder()

              .setTitle(
                "⚠️ التحذير الثاني"
              )

              .setDescription(

                `👤 **العضو:** ${target}\n` +
                `🛡️ **بواسطة:** ${moderator}\n` +
                `📝 **السبب:** ${reason}\n\n` +
                `⚠️ تم تسجيل **التحذير الثاني**.`

              )

              .setFooter({
                text:
                  SERVER_NAME
              })

          ]

        });

      }

      // ===============================================
      // Warn 3
      // ===============================================

      if (warnNumber === 3) {

        return interaction.reply({

          embeds: [

            new EmbedBuilder()

              .setTitle(
                "⚠️ التحذير الثالث"
              )

              .setDescription(

                `👤 **العضو:** ${target}\n` +
                `🛡️ **بواسطة:** ${moderator}\n` +
                `📝 **السبب:** ${reason}\n\n` +
                `⚠️ تم تسجيل **التحذير الثالث**.\n` +
                `🔇 التحذير القادم = ميوت يوم كامل.`

              )

              .setFooter({
                text:
                  SERVER_NAME
              })

          ]

        });

      }

      // ===============================================
      // Warn 4 = Timeout يوم
      // ===============================================

      if (warnNumber === 4) {

        try {

          await target.timeout(
            24 * 60 * 60 * 1000,
            `Warn 4: ${reason}`
          );

        } catch (error) {

          console.error(
            "❌ فشل الميوت:",
            error
          );

          return interaction.reply({

            content:
              "⚠️ تم تسجيل التحذير الرابع، لكن لم أستطع عمل الميوت. تأكد من صلاحية Moderate Members وترتيب رتبة البوت.",

            ephemeral: true

          });

        }

        return interaction.reply({

          embeds: [

            new EmbedBuilder()

              .setTitle(
                "🔇 التحذير الرابع"
              )

              .setDescription(

                `👤 **العضو:** ${target}\n` +
                `🛡️ **بواسطة:** ${moderator}\n` +
                `📝 **السبب:** ${reason}\n\n` +
                `🔇 تم عمل **ميوت لمدة 24 ساعة**.`

              )

              .setFooter({
                text:
                  SERVER_NAME
              })

          ]

        });

      }

      // ===============================================
      // Warn 5 = Kick
      // ===============================================

      if (warnNumber === 5) {

        try {

          await target.kick(
            `Warn 5: ${reason}`
          );

        } catch (error) {

          console.error(
            "❌ فشل الكيك:",
            error
          );

          return interaction.reply({

            content:
              "⚠️ تم تسجيل التحذير الخامس، لكن لم أستطع طرد العضو. تأكد من صلاحية Kick Members وترتيب رتبة البوت.",

            ephemeral: true

          });

        }

        return interaction.reply({

          embeds: [

            new EmbedBuilder()

              .setTitle(
                "👢 التحذير الخامس"
              )

              .setDescription(

                `👤 **العضو:** ${target.user.tag}\n` +
                `🛡️ **بواسطة:** ${moderator}\n` +
                `📝 **السبب:** ${reason}\n\n` +
                `👢 تم **طرد العضو من السيرفر**.`

              )

              .setFooter({
                text:
                  SERVER_NAME
              })

          ]

        });

      }

      // ===============================================
      // Warn 6 = Ban
      // ===============================================

      if (warnNumber >= 6) {

        try {

          await target.ban({

            reason:
              `Warn 6: ${reason}`

          });

        } catch (error) {

          console.error(
            "❌ فشل البان:",
            error
          );

          return interaction.reply({

            content:
              "⚠️ تم تسجيل التحذير السادس، لكن لم أستطع حظر العضو. تأكد من صلاحية Ban Members وترتيب رتبة البوت.",

            ephemeral: true

          });

        }

        return interaction.reply({

          embeds: [

            new EmbedBuilder()

              .setTitle(
                "🔨 التحذير السادس"
              )

              .setDescription(

                `👤 **العضو:** ${target.user.tag}\n` +
                `🛡️ **بواسطة:** ${moderator}\n` +
                `📝 **السبب:** ${reason}\n\n` +
                `🔨 تم **حظر العضو من السيرفر**.`

              )

              .setFooter({
                text:
                  SERVER_NAME
              })

          ]

        });

      }

    }

    // =================================================
    // /staffrequest
    // =================================================

    if (
      interaction.commandName ===
      "staffrequest"
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
          `📢 **طلب حضور الإدارة**\n\n` +
          `<@${member.id}> يحتاج حضور الإدارة.\n\n` +
          (
            mentions.length
              ? mentions.join(" ")
              : "لم يتم العثور على رتب الإدارة العليا."
          )

      });

    }

    // =================================================
    // /setup-ticket
    // =================================================

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

          )

          .setFooter({
            text:
              SERVER_NAME
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

              .setEmoji("🎫")

              .setStyle(
                ButtonStyle.Success
              )

          );

      return interaction.reply({

        embeds: [
          embed
        ],

        components: [
          row
        ]

      });

    }

  }
);

// =====================================================
// أخطاء البوت
// =====================================================

client.on(
  "error",
  error => {

    console.error(
      "❌ Discord Client Error:",
      error
    );

  }
);

process.on(
  "unhandledRejection",
  error => {

    console.error(
      "❌ Unhandled Rejection:",
      error
    );

  }
);

// =====================================================
// تشغيل البوت
// =====================================================

client.login(TOKEN);
